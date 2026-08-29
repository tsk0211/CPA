import ExcelJS from "exceljs";
import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { Project } from "../models/Project.js";
import { Purchase } from "../models/Purchase.js";
import { parsePageParams, searchFilter, toPagedResult } from "../pagination.js";

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

// Paginated + searchable (by description) — a busy project can accumulate
// far more purchases than fit on one screen.
purchasesRouter.get("/project/:projectId", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter = {
    projectId: req.params.projectId,
    deletedAt: null,
    ...(searchFilter("description", req.query.search) ?? {}),
  };

  const total = await Purchase.countDocuments(filter);
  const purchases = await Purchase.find(filter).sort({ purchasedAt: -1 }).skip(pageParams.skip).limit(pageParams.limit);
  res.json(toPagedResult(purchases, total, pageParams));
});

// Cross-project "what's recently been logged" feed (the app's Activity
// view) — paginated, most recent first, not restricted to today.
purchasesRouter.get("/recent", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter = { deletedAt: null, ...(searchFilter("description", req.query.search) ?? {}) };

  const total = await Purchase.countDocuments(filter);
  const purchases = await Purchase.find(filter)
    .populate("projectId", "name icon")
    .populate("createdBy", "name")
    .sort({ purchasedAt: -1 })
    .skip(pageParams.skip)
    .limit(pageParams.limit);
  res.json(toPagedResult(purchases, total, pageParams));
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

// --- Reports export (owner, admin, analyst) ---
//
// GET /purchases/export?format=csv|xlsx&projectIds=id1,id2&from=ISO&to=ISO&includeAuditTrail=true
//
// - No projectIds -> every currently active project.
// - includeAuditTrail only applies to xlsx (a second sheet); csv is a
//   single flat file so the flag is silently ignored there rather than
//   erroring — the client disables the toggle when csv is selected.
purchasesRouter.get("/export", requireRole("owner", "admin", "analyst"), async (req, res) => {
  const format = req.query.format === "xlsx" ? "xlsx" : "csv";
  const projectIds = typeof req.query.projectIds === "string" && req.query.projectIds.length > 0 ? req.query.projectIds.split(",") : null;
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  const includeAuditTrail = format === "xlsx" && req.query.includeAuditTrail === "true";

  const targetProjectIds =
    projectIds ?? (await Project.find({ deletedAt: null }).distinct("_id"));

  const purchases = await Purchase.find({
    projectId: { $in: targetProjectIds },
    deletedAt: null,
    ...(Object.keys(dateFilter).length ? { purchasedAt: dateFilter } : {}),
  })
    .populate("projectId", "name")
    .populate("createdBy", "name")
    .sort({ purchasedAt: -1 });

  const rows = purchases.map((p) => ({
    project: (p.projectId as unknown as { name: string })?.name ?? "unknown",
    amount: p.amount,
    description: p.description,
    loggedBy: (p.createdBy as unknown as { name: string })?.name ?? "unknown",
    purchasedAt: p.purchasedAt.toISOString(),
  }));

  if (format === "csv") return sendCsv(res, "cpa-export.csv", rows);

  const workbook = new ExcelJS.Workbook();
  const purchaseSheet = workbook.addWorksheet("Purchases");
  purchaseSheet.columns = [
    { header: "Project", key: "project", width: 28 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: "#,##0.00" } },
    { header: "Description", key: "description", width: 40 },
    { header: "Logged By", key: "loggedBy", width: 22 },
    { header: "Purchased At", key: "purchasedAt", width: 22 },
  ];
  purchaseSheet.addRows(rows);
  purchaseSheet.getRow(1).font = { bold: true };

  if (includeAuditTrail) {
    // Full history (including soft-deleted) for the same project scope +
    // date range, so "who changed what" is answerable even for purchases
    // that no longer show up in the main sheet.
    const historicalPurchaseIds = await Purchase.find({
      projectId: { $in: targetProjectIds },
      ...(Object.keys(dateFilter).length ? { purchasedAt: dateFilter } : {}),
    }).distinct("_id");

    const auditFilter: Record<string, unknown> = {
      $or: [
        { entityType: "project", entityId: { $in: targetProjectIds } },
        { entityType: "purchase", entityId: { $in: historicalPurchaseIds } },
      ],
    };
    const createdAtFilter = buildDateFilter(req.query.from, req.query.to);
    if (Object.keys(createdAtFilter).length) auditFilter.createdAt = createdAtFilter;

    const auditEntries = await AuditLog.find(auditFilter).sort({ createdAt: -1 });

    const auditSheet = workbook.addWorksheet("Audit Trail");
    auditSheet.columns = [
      { header: "When", key: "when", width: 22 },
      { header: "Who", key: "who", width: 22 },
      { header: "Role", key: "role", width: 12 },
      { header: "Action", key: "action", width: 18 },
      { header: "Before", key: "before", width: 40 },
      { header: "After", key: "after", width: 40 },
    ];
    auditSheet.addRows(
      auditEntries.map((entry) => ({
        when: entry.createdAt.toISOString(),
        who: entry.actorName,
        role: entry.actorRole,
        action: entry.action,
        before: entry.before ? JSON.stringify(entry.before) : "",
        after: entry.after ? JSON.stringify(entry.after) : "",
      })),
    );
    auditSheet.getRow(1).font = { bold: true };
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="cpa-export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

function buildDateFilter(from: unknown, to: unknown): Record<string, Date> {
  const filter: Record<string, Date> = {};
  if (typeof from === "string" && from) filter.$gte = new Date(from);
  if (typeof to === "string" && to) filter.$lte = new Date(to);
  return filter;
}

function sendCsv(res: import("express").Response, filename: string, rows: Record<string, string | number>[]) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["project", "amount", "description", "loggedBy", "purchasedAt"];
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
