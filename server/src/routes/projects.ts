import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { Purchase } from "../models/Purchase.js";
import { parsePageParams, searchFilter, toPagedResult } from "../pagination.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, blockIfMustChangePassword);

// Purchase.projectId is stored as a plain string (see models/Purchase.ts)
// while Project._id is a real ObjectId — .find()/.findOne() cast between
// the two automatically, but .aggregate() does NOT, so ids must be
// stringified before being used in a $match/$in here.
// Only approved purchases count toward the total — a Member's pending
// purchase doesn't move the number until an Owner/Admin reviews it, and a
// rejected one never does. See routes/purchases.ts for the review workflow.
async function totalsByProjectId(projectIds: string[]): Promise<Map<string, number>> {
  const sums = await Purchase.aggregate<{ _id: string; total: number }>([
    { $match: { projectId: { $in: projectIds }, deletedAt: null, status: "approved" } },
    { $group: { _id: "$projectId", total: { $sum: "$amount" } } },
  ]);
  return new Map(sums.map((s) => [s._id, s.total]));
}

// Any authenticated, active role can read. Paginated + searchable by name —
// this list is expected to grow to 100+ projects, so it was never safe to
// just return everything unbounded.
projectsRouter.get("/", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter = { deletedAt: null, ...(searchFilter("name", req.query.search) ?? {}) };

  const total = await Project.countDocuments(filter);
  const projects = await Project.find(filter).sort({ name: 1 }).skip(pageParams.skip).limit(pageParams.limit);

  // One aggregate query for all totals on this page, not one query per
  // project — avoids an N+1 as the project count grows.
  const totalByProject = await totalsByProjectId(projects.map((p) => p._id.toString()));

  const items = projects.map((p) => ({ ...p.toObject(), totalSpent: totalByProject.get(p._id.toString()) ?? 0 }));
  res.json(toPagedResult(items, total, pageParams));
});

// Single project with its current total — the client refetches this after
// any purchase create/edit/delete so "Total spent" on the detail screen
// never drifts from what was passed in when the screen was opened.
projectsRouter.get("/:id", async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const totalByProject = await totalsByProjectId([project._id.toString()]);
  res.json({ ...project.toObject(), totalSpent: totalByProject.get(project._id.toString()) ?? 0 });
});

// Only owner/admin can create, rename, or delete projects.
projectsRouter.post("/", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { name, icon } = req.body as { name?: string; icon?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const project = await Project.create({
    name: name.trim(),
    icon: icon?.trim() || "📁",
    createdBy: req.user!.id,
  });

  await logActivity(req, {
    action: "project.create",
    entityType: "project",
    entityId: project._id,
    after: { name: project.name, icon: project.icon },
  });

  res.status(201).json(project);
});

// Renaming and re-iconing a project are the same "edit" action from the
// UI's perspective (one sheet, both fields) so they share one endpoint and
// one audit entry. autoApproveThreshold is a separate, optional field on
// the same request but gets its own audit entry (a financial-control
// change, not a cosmetic edit) — see models/AuditLog.ts.
projectsRouter.patch("/:id", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { name, icon, autoApproveThreshold } = req.body as { name?: string; icon?: string; autoApproveThreshold?: number };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  if (autoApproveThreshold !== undefined && (typeof autoApproveThreshold !== "number" || autoApproveThreshold < 0)) {
    return res.status(400).json({ error: "autoApproveThreshold must be a non-negative number" });
  }

  const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const before = { name: project.name, icon: project.icon };
  project.name = name.trim();
  if (icon?.trim()) project.icon = icon.trim();
  await project.save();

  await logActivity(req, {
    action: "project.rename",
    entityType: "project",
    entityId: project._id,
    before,
    after: { name: project.name, icon: project.icon },
  });

  if (autoApproveThreshold !== undefined && autoApproveThreshold !== project.autoApproveThreshold) {
    const thresholdBefore = project.autoApproveThreshold;
    project.autoApproveThreshold = autoApproveThreshold;
    await project.save();

    await logActivity(req, {
      action: "project.auto_approve_threshold_change",
      entityType: "project",
      entityId: project._id,
      before: { autoApproveThreshold: thresholdBefore },
      after: { autoApproveThreshold: project.autoApproveThreshold },
    });
  }

  res.json(project);
});

projectsRouter.delete("/:id", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const now = new Date();
  project.deletedAt = now;
  project.deletedBy = req.user!.id;
  await project.save();

  // Cascade the soft-delete so the project's purchases also drop out of
  // normal views without ever being destroyed.
  await Purchase.updateMany(
    { projectId: project._id, deletedAt: null },
    { deletedAt: now, deletedBy: req.user!.id },
  );

  await logActivity(req, {
    action: "project.delete",
    entityType: "project",
    entityId: project._id,
    before: { name: project.name },
  });

  res.status(204).end();
});
