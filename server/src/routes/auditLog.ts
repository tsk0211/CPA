import { Router } from "express";
import { blockIfMustChangePassword, requireAuth, requireRole } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { parsePageParams, toPagedResult } from "../pagination.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth, blockIfMustChangePassword, requireRole("owner", "admin", "analyst"));

auditLogRouter.get("/", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.action === "string" && req.query.action) filter.action = req.query.action;

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).skip(pageParams.skip).limit(pageParams.limit);
  res.json(toPagedResult(logs, total, pageParams));
});
