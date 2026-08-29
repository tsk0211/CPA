import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { Purchase } from "../models/Purchase.js";

export const purchasesRouter = Router();

purchasesRouter.use(requireAuth, blockIfMustChangePassword);

// Owner, admin, and member can all log a cash purchase. Analyst is read/export only.
purchasesRouter.post("/", requireRole("owner", "admin", "member"), async (req: AuthedRequest, res) => {
  const { projectId, amount, description } = req.body as {
    projectId?: string;
    amount?: number;
    description?: string;
  };
  if (!projectId || !amount || amount <= 0 || !description?.trim()) {
    return res.status(400).json({ error: "projectId, a positive amount, and a description are required" });
  }

  const project = await Project.findOne({ _id: projectId, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const purchase = await Purchase.create({
    projectId,
    amount,
    description: description.trim(),
    createdBy: req.user!.id,
  });

  await logActivity(req, {
    action: "purchase.create",
    entityType: "purchase",
    entityId: purchase._id,
    after: { projectId, amount: purchase.amount, description: purchase.description },
  });

  res.status(201).json(purchase);
});

purchasesRouter.get("/project/:projectId", async (req, res) => {
  const purchases = await Purchase.find({ projectId: req.params.projectId, deletedAt: null }).sort({ purchasedAt: -1 });
  res.json(purchases);
});

// Cross-project view of everything logged today (UTC day boundaries).
purchasesRouter.get("/today", async (_req, res) => {
  const { start, end } = utcDayBounds(new Date());
  const purchases = await Purchase.find({ purchasedAt: { $gte: start, $lt: end }, deletedAt: null }).sort({
    purchasedAt: -1,
  });
  res.json(purchases);
});

// Only owner/admin can correct or remove a logged purchase — always
// soft-deleted, so the original figure is never actually gone.
purchasesRouter.patch("/:id", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { amount, description } = req.body as { amount?: number; description?: string };
  if (amount !== undefined && amount <= 0) return res.status(400).json({ error: "amount must be positive" });

  const purchase = await Purchase.findOne({ _id: req.params.id, deletedAt: null });
  if (!purchase) return res.status(404).json({ error: "purchase not found" });

  const before = { amount: purchase.amount, description: purchase.description };
  if (amount !== undefined) purchase.amount = amount;
  if (description?.trim()) purchase.description = description.trim();
  purchase.editedBy = req.user!.id;
  purchase.editedAt = new Date();
  await purchase.save();

  await logActivity(req, {
    action: "purchase.edit",
    entityType: "purchase",
    entityId: purchase._id,
    before,
    after: { amount: purchase.amount, description: purchase.description },
  });

  res.json(purchase);
});

purchasesRouter.delete("/:id", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, deletedAt: null });
  if (!purchase) return res.status(404).json({ error: "purchase not found" });

  purchase.deletedAt = new Date();
  purchase.deletedBy = req.user!.id;
  await purchase.save();

  await logActivity(req, {
    action: "purchase.delete",
    entityType: "purchase",
    entityId: purchase._id,
    before: { amount: purchase.amount, description: purchase.description },
  });

  res.status(204).end();
});

// --- Export (owner, admin, analyst) ---

purchasesRouter.get("/export/project/:projectId", requireRole("owner", "admin", "analyst"), async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, deletedAt: null });
  if (!project) return res.status(404).json({ error: "project not found" });

  const purchases = await Purchase.find({ projectId: project._id, deletedAt: null })
    .populate("createdBy", "name")
    .sort({ purchasedAt: -1 });

  sendCsv(res, `${project.name}-purchases.csv`, purchases.map((p) => ({
    project: project.name,
    amount: p.amount,
    description: p.description,
    loggedBy: (p.createdBy as unknown as { name: string })?.name ?? "unknown",
    purchasedAt: p.purchasedAt.toISOString(),
  })));
});

purchasesRouter.get("/export/all", requireRole("owner", "admin", "analyst"), async (_req, res) => {
  const purchases = await Purchase.find({ deletedAt: null })
    .populate("createdBy", "name")
    .populate("projectId", "name")
    .sort({ purchasedAt: -1 });

  sendCsv(res, "all-projects-purchases.csv", purchases.map((p) => ({
    project: (p.projectId as unknown as { name: string })?.name ?? "unknown",
    amount: p.amount,
    description: p.description,
    loggedBy: (p.createdBy as unknown as { name: string })?.name ?? "unknown",
    purchasedAt: p.purchasedAt.toISOString(),
  })));
});

function utcDayBounds(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function sendCsv(res: import("express").Response, filename: string, rows: Record<string, string | number>[]) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["project", "amount", "description", "loggedBy", "purchasedAt"];
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
