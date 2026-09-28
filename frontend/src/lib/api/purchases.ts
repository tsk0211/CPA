import { api } from "./client";
import type { Paged, Purchase } from "@/types";

function newIdempotencyKey(): string {
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const purchasesApi = {
  forProject: (projectId: string, params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get(`/purchases/project/${projectId}`, {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
      search: params.search || undefined,
    }) as Promise<Paged<Purchase>>,

  recent: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get("/purchases/recent", {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
      search: params.search || undefined,
    }) as Promise<Paged<Purchase>>,

  create: (input: {
    projectId: string;
    amount: number;
    description: string;
    quantity?: number;
    unit?: string;
    vendor?: string;
    category?: string;
    notes?: string;
  }) =>
    api.post("/purchases", { ...input, idempotencyKey: newIdempotencyKey() }) as Promise<Purchase>,

  update: (
    id: string,
    input: { amount?: number; description?: string; quantity?: number | null; unit?: string | null; vendor?: string | null; category?: string | null; notes?: string | null },
  ) => api.patch(`/purchases/${id}`, input) as Promise<Purchase>,

  delete: (id: string) => api.delete(`/purchases/${id}`),

  pending: (params: { page?: number; limit?: number } = {}) =>
    api.get("/purchases/pending", { page: String(params.page ?? 1), limit: String(params.limit ?? 20) }) as Promise<Paged<Purchase>>,

  approve: (id: string) => api.patch(`/purchases/${id}/review`, { action: "approve" }) as Promise<Purchase>,

  reject: (id: string, reason: string) => api.patch(`/purchases/${id}/review`, { action: "reject", reason }) as Promise<Purchase>,

  search: (params: { page?: number; limit?: number; projectIds?: string[]; from?: Date; to?: Date }) =>
    api.get("/purchases/search", {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
      projectIds: params.projectIds?.length ? params.projectIds.join(",") : undefined,
      from: params.from?.toISOString(),
      to: params.to?.toISOString(),
    }) as Promise<Paged<Purchase> & { totalAmount: number }>,

  export: async (params: { format: "csv" | "xlsx"; projectIds?: string[]; from?: Date; to?: Date; includeAuditTrail?: boolean }) =>
    api.getBlob("/purchases/export", {
      format: params.format,
      projectIds: params.projectIds?.length ? params.projectIds.join(",") : undefined,
      from: params.from?.toISOString(),
      to: params.to?.toISOString(),
      includeAuditTrail: params.includeAuditTrail ? "true" : undefined,
    }),

  trend: (params: { days?: number; projectIds?: string[] } = {}) =>
    api
      .get("/purchases/trend", {
        days: String(params.days ?? 30),
        projectIds: params.projectIds?.length ? params.projectIds.join(",") : undefined,
        tzOffset: tzOffsetString(),
      })
      .then((json) => (json.points as { date: string; total: number }[]).map((p) => ({ date: p.date, total: p.total }))),
};

// Same UTC-offset scheme as lib/api/purchases_api.dart's trend() — the
// server buckets days by the caller's local calendar day, not raw UTC.
function tzOffsetString(): string {
  const offsetMinutes = -new Date().getTimezoneOffset(); // JS: positive = ahead of UTC is negative offset, so flip
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
