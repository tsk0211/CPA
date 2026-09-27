// Shared by purchases.ts and auditLog.ts so date-range filtering (list +
// export, on both routers) never drifts apart on what counts as a valid
// from/to value.

export class InvalidDateError extends Error {}

function parseDateOrThrow(raw: string, paramName: "from" | "to"): Date {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidDateError(`${paramName} is not a valid date`);
  }
  return date;
}

export function buildDateFilter(from: unknown, to: unknown): Record<string, Date> {
  const filter: Record<string, Date> = {};
  if (typeof from === "string" && from) filter.$gte = parseDateOrThrow(from, "from");
  if (typeof to === "string" && to) filter.$lte = parseDateOrThrow(to, "to");
  return filter;
}
