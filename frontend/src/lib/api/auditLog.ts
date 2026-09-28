import { api } from "./client";
import type { AuditEntry, Paged } from "@/types";

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

function query(f: AuditLogFilters) {
  return {
    page: String(f.page ?? 1),
    limit: String(f.limit ?? 20),
    projectId: f.projectId,
    actorId: f.actorId,
    action: f.action,
    from: f.from?.toISOString(),
    to: f.to?.toISOString(),
  };
}

export const auditLogApi = {
  list: (filters: AuditLogFilters = {}) => api.get("/audit-log", query(filters)) as Promise<Paged<AuditEntry>>,

  export: (filters: AuditLogFilters = {}) => api.getBlob("/audit-log/export", query(filters)),
};
