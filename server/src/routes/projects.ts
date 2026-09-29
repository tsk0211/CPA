import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { ProjectMember } from "../models/ProjectMember.js";
import { Purchase } from "../models/Purchase.js";
import { Role } from "../models/Role.js";
import { User } from "../models/User.js";
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
  const { name, icon, description, budget } = req.body as { name?: string; icon?: string; description?: string; budget?: number | null };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  if (budget !== undefined && budget !== null && (typeof budget !== "number" || budget < 0)) {
    return res.status(400).json({ error: "budget must be a non-negative number or null" });
  }

  const project = await Project.create({
    name: name.trim(),
    icon: icon?.trim() || "📁",
    description: description?.trim() || "",
    budget: budget ?? null,
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
  const { name, icon, description, budget, autoApproveThreshold } = req.body as {
    name?: string;
    icon?: string;
    description?: string;
    budget?: number | null;
    autoApproveThreshold?: number;
  };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  if (autoApproveThreshold !== undefined && (typeof autoApproveThreshold !== "number" || autoApproveThreshold < 0)) {
    return res.status(400).json({ error: "autoApproveThreshold must be a non-negative number" });
  }
  if (budget !== undefined && budget !== null && (typeof budget !== "number" || budget < 0)) {
    return res.status(400).json({ error: "budget must be a non-negative number or null" });
  }

  const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const before = { name: project.name, icon: project.icon };
  const nextName = name.trim();
  const nextIcon = icon?.trim() || project.icon;
  const nameOrIconChanged = nextName !== project.name || nextIcon !== project.icon;
  project.name = nextName;
  project.icon = nextIcon;
  // Cosmetic-ish fields, folded into the same save as name/icon — not
  // separately audited (unlike autoApproveThreshold below, which is a
  // financial-control change and gets its own entry).
  if (description !== undefined) project.description = description.trim();
  if (budget !== undefined) project.budget = budget;
  if (nameOrIconChanged || description !== undefined || budget !== undefined) await project.save();

  if (nameOrIconChanged) {
    await logActivity(req, {
      action: "project.rename",
      entityType: "project",
      entityId: project._id,
      before,
      after: { name: project.name, icon: project.icon },
    });
  }

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

    // Re-evaluate purchases already sitting in this project's review queue
    // against the new threshold — anything that would now qualify for
    // auto-approve (same rule as at creation, see routes/purchases.ts) gets
    // approved immediately rather than left stuck under a now-stale limit.
    // Offline-captured purchases are excluded: those always require manual
    // review regardless of amount, which the threshold has no bearing on.
    const newlyQualifying = await Purchase.find({
      projectId: project._id,
      deletedAt: null,
      status: "pending",
      capturedOffline: { $ne: true },
      amount: { $lte: autoApproveThreshold },
    });
    const now = new Date();
    for (const purchase of newlyQualifying) {
      purchase.status = "approved";
      purchase.reviewedBy = req.user!.id;
      purchase.reviewedAt = now;
      await purchase.save();
      await logActivity(req, {
        action: "purchase.approve",
        entityType: "purchase",
        entityId: purchase._id,
        before: { status: "pending" },
        after: { status: "approved", reason: `auto-approved: project's threshold raised to ${autoApproveThreshold}` },
      });
    }
  }

  res.json(project);
});

// Lets the client show "changing this will approve N pending purchases
// totaling $X" before the admin commits to a threshold change via PATCH —
// computed with the exact same rule PATCH itself applies, so the preview
// never promises something the save doesn't actually do.
projectsRouter.get("/:id/auto-approve-preview", requireRole("owner", "admin"), async (req, res) => {
  const threshold = Number(req.query.threshold);
  if (!Number.isFinite(threshold) || threshold < 0) {
    return res.status(400).json({ error: "threshold must be a non-negative number" });
  }

  const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const filter = {
    projectId: project._id,
    deletedAt: null,
    status: "pending",
    capturedOffline: { $ne: true },
    amount: { $lte: threshold },
  };
  const [count, totalAgg] = await Promise.all([
    Purchase.countDocuments(filter),
    Purchase.aggregate<{ _id: null; total: number }>([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);

  res.json({ count, totalAmount: totalAgg[0]?.total ?? 0 });
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

// --- Project membership: who's assigned to this project, and with what
// role. Distinct from a user's global role — see models/ProjectMember.ts.

async function memberToJson(member: InstanceType<typeof ProjectMember>) {
  const [user, role] = await Promise.all([User.findById(member.userId), Role.findById(member.roleId)]);
  return {
    userId: member.userId,
    userName: user?.name ?? "(deactivated)",
    userEmail: user?.email ?? "",
    roleId: member.roleId,
    roleName: role?.name ?? member.roleId,
    assignedAt: member.assignedAt,
  };
}

// Any authenticated active role can read (same visibility as the project itself).
projectsRouter.get("/:id/members", async (req, res) => {
  const members = await ProjectMember.find({ projectId: req.params.id, revokedAt: null }).sort({ assignedAt: 1 });
  res.json(await Promise.all(members.map(memberToJson)));
});

// Upsert semantics: assigning someone already on the project just changes
// their role in place instead of erroring, so the "add team" step of the
// project wizard can call this once per selected person without needing
// to know who's already been added in a previous pass.
projectsRouter.post("/:id/members", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { userId, roleId } = req.body as { userId?: string; roleId?: string };
  if (!userId || !roleId) return res.status(400).json({ error: "userId and roleId are required" });

  const [project, user, role] = await Promise.all([
    Project.findOne({ _id: req.params.id, deletedAt: null }),
    User.findOne({ _id: userId, deletedAt: null }),
    Role.findOne({ _id: roleId, deletedAt: null }),
  ]);
  if (!project) return res.status(404).json({ error: "project not found" });
  if (!user) return res.status(400).json({ error: "user not found or deactivated" });
  // roleId must reference an actual Role document — "owner"/"admin" are
  // global literals, not something you're assigned to a project for.
  if (!role) return res.status(400).json({ error: "role not found (owner/admin can't be assigned per-project)" });

  const existing = await ProjectMember.findOne({ projectId: project._id, userId, revokedAt: null });
  if (existing) {
    existing.roleId = roleId;
    await existing.save();
    await logActivity(req, {
      action: "project.member_add",
      entityType: "project",
      entityId: project._id,
      after: { userName: user.name, roleName: role.name },
    });
    return res.json(await memberToJson(existing));
  }

  const member = await ProjectMember.create({
    projectId: project._id,
    userId,
    roleId,
    assignedBy: req.user!.id,
  });

  await logActivity(req, {
    action: "project.member_add",
    entityType: "project",
    entityId: project._id,
    after: { userName: user.name, roleName: role.name },
  });

  res.status(201).json(await memberToJson(member));
});

projectsRouter.delete("/:id/members/:userId", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const member = await ProjectMember.findOne({ projectId: req.params.id, userId: req.params.userId, revokedAt: null });
  if (!member) return res.status(404).json({ error: "membership not found" });

  const user = await User.findById(member.userId);
  member.revokedAt = new Date();
  member.revokedBy = req.user!.id;
  await member.save();

  await logActivity(req, {
    action: "project.member_remove",
    entityType: "project",
    entityId: req.params.id,
    before: { userName: user?.name ?? member.userId },
  });

  res.status(204).end();
});
