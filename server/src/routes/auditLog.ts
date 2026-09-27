import ExcelJS from "exceljs";
import { Router } from "express";
import { blockIfMustChangePassword, requireAuth, requireRole } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { parsePageParams, toPagedResult } from "../pagination.js";
import { Purchase } from "../models/Purchase.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth, blockIfMustChangePassword, requireRole("owner", "admin", "analyst"));

function buildDateFilter(from: unknown, to: unknown): Record<string, Date> {
  const filter: Record<string, Date> = {};
  if (typeof from === "string" && from) filter.$gte = new Date(from);
  if (typeof to === "string" && to) filter.$lte = new Date(to);
  return filter;
}

// Shared by the list and export endpoints so filtering never drifts between
// what you see on screen and what you get in the export.
// - actorId filters by person (the UI shows a name, but filters by id —
//   names aren't unique and can be reused after a deactivated account).
// - projectId scopes to one project's own project.* entries plus every
//   purchase.* entry for a purchase that ever belonged to it, including
//   purchases since edited or soft-deleted.
async function buildAuditFilter(query: Record<string, unknown>): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {};
  if (typeof query.action === "string" && query.action) filter.action = query.action;
  if (typeof query.actorId === "string" && query.actorId) filter.actorId = query.actorId;

  const dateFilter = buildDateFilter(query.from, query.to);
  if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;

  if (typeof query.projectId === "string" && query.projectId) {
    const projectId = query.projectId;
    const purchaseIds = await Purchase.find({ projectId }).distinct("_id");
    filter.$or = [
      { entityType: "project", entityId: projectId },
      { entityType: "purchase", entityId: { $in: purchaseIds } },
    ];
  }

  return filter;
}

// ?projectId=, ?actorId=, ?action=, ?from=, ?to= (all optional, combinable).
auditLogRouter.get("/", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter = await buildAuditFilter(req.query);

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).skip(pageParams.skip).limit(pageParams.limit);
  res.json(toPagedResult(logs, total, pageParams));
});

// GET /audit-log/export?projectId=&actorId=&action=&from=ISO&to=ISO
// Same filters as the list endpoint, no pagination — the whole matching set
// as one .xlsx sheet.
auditLogRouter.get("/export", async (req, res) => {
  const filter = await buildAuditFilter(req.query);
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Audit Log");
  sheet.columns = [
    { header: "When", key: "when", width: 22 },
    { header: "Who", key: "who", width: 22 },
    { header: "Role", key: "role", width: 12 },
    { header: "Action", key: "action", width: 30 },
    { header: "Entity Type", key: "entityType", width: 14 },
    { header: "Entity Id", key: "entityId", width: 26 },
    { header: "Before", key: "before", width: 40 },
    { header: "After", key: "after", width: 40 },
  ];
  sheet.addRows(
    logs.map((entry) => ({
      when: entry.createdAt.toISOString(),
      who: entry.actorName,
      role: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before ? JSON.stringify(entry.before) : "",
      after: entry.after ? JSON.stringify(entry.after) : "",
    })),
  );
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="cpa-audit-log.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});
