import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { Purchase } from "../models/Purchase.js";
import { parsePageParams, searchFilter, toPagedResult } from "../pagination.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, blockIfMustChangePassword);

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
  const projectIds = projects.map((p) => p._id);
  const sums = await Purchase.aggregate<{ _id: string; total: number }>([
    { $match: { projectId: { $in: projectIds }, deletedAt: null } },
    { $group: { _id: "$projectId", total: { $sum: "$amount" } } },
  ]);
  const totalByProject = new Map(sums.map((s) => [s._id, s.total]));

  const items = projects.map((p) => ({ ...p.toObject(), totalSpent: totalByProject.get(p._id) ?? 0 }));
  res.json(toPagedResult(items, total, pageParams));
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
// one audit entry.
projectsRouter.patch("/:id", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { name, icon } = req.body as { name?: string; icon?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

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
