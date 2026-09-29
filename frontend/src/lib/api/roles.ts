import { api } from "./client";
import type { CustomRole } from "@/types";

// Only "owner"/"admin" are fixed literals — everything else assignable
// (the seeded "member"/"analyst"/"project_manager" defaults, plus
// whatever an owner creates later) lives in this catalog. Any UI offering
// a role choice should fetch this rather than hardcoding a role list —
// that hardcoded list is exactly what used to let "Owner" show up as a
// selectable option, which it must never be.
export const rolesApi = {
  list: () => api.get("/roles") as Promise<CustomRole[]>,

  create: (input: { name: string; permissions: Partial<CustomRole["permissions"]>; rank: number }) =>
    api.post("/roles", input) as Promise<CustomRole>,

  update: (id: string, input: { name?: string; permissions?: Partial<CustomRole["permissions"]>; rank?: number }) =>
    api.patch(`/roles/${id}`, input) as Promise<CustomRole>,

  delete: (id: string) => api.delete(`/roles/${id}`),
};
