import { api } from "./client";
import type { AuditEntry, Paged } from "@/types";

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  actorId?: string;
  // A task is often split across several people — actorIds filters by all
  // of them at once (server does actorId $in [...]), for "what did this
  // group do" rather than one person at a time. Takes precedence over
  // actorId if both are somehow set.
  actorIds?: string[];
  action?: string;
  // approve+reject together, for "what did I decide recently" — see actorIds.
  actions?: string[];
  from?: Date;
  to?: Date;
}

function query(f: AuditLogFilters) {
  return {
    page: String(f.page ?? 1),
    limit: String(f.limit ?? 20),
    projectId: f.projectId,
    actorId: f.actorId,
    actorIds: f.actorIds?.length ? f.actorIds.join(",") : undefined,
    action: f.action,
    actions: f.actions?.length ? f.actions.join(",") : undefined,
    from: f.from?.toISOString(),
    to: f.to?.toISOString(),
  };
}

export const auditLogApi = {
  list: (filters: AuditLogFilters = {}) => api.get("/audit-log", query(filters)) as Promise<Paged<AuditEntry>>,

  export: (filters: AuditLogFilters = {}) => api.getBlob("/audit-log/export", query(filters)),
};
