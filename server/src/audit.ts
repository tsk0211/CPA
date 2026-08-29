import { AuditLog, type AuditAction } from "./models/AuditLog.js";
import type { AuthedRequest } from "./middleware/auth.js";

export async function logActivity(
  req: AuthedRequest,
  params: {
    action: AuditAction;
    entityType: "project" | "purchase" | "user";
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  const actor = req.user!;
  await AuditLog.create({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
  });
}
