import { api } from "./client";
import type { Paged, Project } from "@/types";

export const projectsApi = {
  list: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get("/projects", {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
      search: params.search || undefined,
    }) as Promise<Paged<Project>>,

  get: (id: string) => api.get(`/projects/${id}`) as Promise<Project>,

  create: (name: string, icon: string) => api.post("/projects", { name, icon }) as Promise<Project>,

  update: (id: string, name: string, icon: string, autoApproveThreshold?: number) =>
    api.patch(`/projects/${id}`, { name, icon, ...(autoApproveThreshold !== undefined ? { autoApproveThreshold } : {}) }) as Promise<Project>,

  delete: (id: string) => api.delete(`/projects/${id}`),

  autoApproveThresholdPreview: (id: string, threshold: number) =>
    api.get(`/projects/${id}/auto-approve-preview`, { threshold: String(threshold) }) as Promise<{ count: number; totalAmount: number }>,
};
