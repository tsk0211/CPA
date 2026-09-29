import { api } from "./client";
import type { Paged, Role, TeamMember } from "@/types";

export const usersApi = {
  list: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get("/users", {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
      search: params.search || undefined,
    }) as Promise<Paged<TeamMember>>,

  create: (input: { name: string; email: string; tempPassword: string; role: Role }) => api.post("/users", input),

  changeRole: (userId: string, role: Role) => api.patch(`/users/${userId}/role`, { role }),

  deactivate: (userId: string) => api.delete(`/users/${userId}`),
};
