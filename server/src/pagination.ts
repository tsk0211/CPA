import type { Request } from "express";

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function parsePageParams(req: Request): PageParams {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function toPagedResult<T>(items: T[], total: number, { page, limit }: PageParams): PagedResult<T> {
  return { items, page, limit, total, hasMore: page * limit < total };
}

// Case-insensitive "contains" search, safe against regex injection from
// user input (special chars escaped rather than passed straight into a
// Mongo $regex).
export function searchFilter(field: string, raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const escaped = raw.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { [field]: { $regex: escaped, $options: "i" } };
}
