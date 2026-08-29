import { Router } from "express";
import { blockIfMustChangePassword, requireAuth, requireRole } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { parsePageParams, toPagedResult } from "../pagination.js";
import { Purchase } from "../models/Purchase.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth, blockIfMustChangePassword, requireRole("owner", "admin", "analyst"));

// ?projectId= scopes to one project's Project Detail "Activity" section —
// its own project.* entries plus every purchase.* entry for a purchase
// that ever belonged to it, including purchases since edited or
// soft-deleted, so the full history is visible even after a delete.
auditLogRouter.get("/", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.action === "string" && req.query.action) filter.action = req.query.action;

  if (typeof req.query.projectId === "string" && req.query.projectId) {
    const projectId = req.query.projectId;
    const purchaseIds = await Purchase.find({ projectId }).distinct("_id");
    filter.$or = [
      { entityType: "project", entityId: projectId },
      { entityType: "purchase", entityId: { $in: purchaseIds } },
    ];
  }

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).skip(pageParams.skip).limit(pageParams.limit);
  res.json(toPagedResult(logs, total, pageParams));
});
