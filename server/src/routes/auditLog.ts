import { Router } from "express";
import { blockIfMustChangePassword, requireAuth, requireRole } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth, blockIfMustChangePassword, requireRole("owner", "admin", "analyst"));

auditLogRouter.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  res.json(logs);
});
