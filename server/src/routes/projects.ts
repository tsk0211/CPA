import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { Purchase } from "../models/Purchase.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, blockIfMustChangePassword);

// Any authenticated, active role can read.
projectsRouter.get("/", async (_req, res) => {
  const projects = await Project.find({ deletedAt: null }).sort({ name: 1 });
  res.json(projects);
});

// Only owner/admin can create, rename, or delete projects.
projectsRouter.post("/", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const project = await Project.create({ name: name.trim(), createdBy: req.user!.id });

  await logActivity(req, {
    action: "project.create",
    entityType: "project",
    entityId: project._id,
    after: { name: project.name },
  });

  res.status(201).json(project);
});

projectsRouter.patch("/:id", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const project = await Project.findOne({ _id: req.params.id, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const before = { name: project.name };
  project.name = name.trim();
  await project.save();

  await logActivity(req, {
    action: "project.rename",
    entityType: "project",
    entityId: project._id,
    before,
    after: { name: project.name },
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
