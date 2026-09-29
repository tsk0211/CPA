import { api } from "./client";
import type { Paged, Project, ProjectMember } from "@/types";

export const projectsApi = {
  list: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get("/projects", {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
      search: params.search || undefined,
    }) as Promise<Paged<Project>>,

  get: (id: string) => api.get(`/projects/${id}`) as Promise<Project>,

  create: (input: { name: string; icon: string; description?: string; budget?: number | null }) =>
    api.post("/projects", input) as Promise<Project>,

  update: (id: string, input: { name: string; icon: string; description?: string; budget?: number | null; autoApproveThreshold?: number }) =>
    api.patch(`/projects/${id}`, input) as Promise<Project>,

  delete: (id: string) => api.delete(`/projects/${id}`),

  autoApproveThresholdPreview: (id: string, threshold: number) =>
    api.get(`/projects/${id}/auto-approve-preview`, { threshold: String(threshold) }) as Promise<{ count: number; totalAmount: number }>,

  members: (id: string) => api.get(`/projects/${id}/members`) as Promise<ProjectMember[]>,

  addMember: (id: string, userId: string, roleId: string) =>
    api.post(`/projects/${id}/members`, { userId, roleId }) as Promise<ProjectMember>,

  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
};
