export type Role = "owner" | "admin" | "analyst" | "member";

export const roleLabel: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  analyst: "Analyst",
  member: "Member",
};

// Mirrors lib/models/role.dart's getters exactly — the server enforces all
// of this independently; this is only for hiding controls that would 403.
export function roleCan(role: Role) {
  return {
    canManageProjects: role === "owner" || role === "admin",
    canAddPurchases: role === "owner" || role === "admin" || role === "member",
    canEditPurchases: role === "owner" || role === "admin",
    canReviewPurchases: role === "owner" || role === "admin",
    canExport: role === "owner" || role === "admin" || role === "analyst",
    canManageUsers: role === "owner" || role === "admin",
    canSeeActivityLog: role === "owner" || role === "admin" || role === "analyst",
  };
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  createdBy: string;
  createdAt: string;
  totalSpent: number;
  autoApproveThreshold: number;
}

export type PurchaseStatus = "pending" | "approved" | "rejected";

export interface Purchase {
  id: string;
  projectId: string;
  projectName?: string;
  projectIcon?: string;
  amount: number;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  vendor?: string | null;
  category?: string | null;
  notes?: string | null;
  createdBy: string;
  createdByName?: string;
  purchasedAt: string;
  editedAt?: string | null;
  status: PurchaseStatus;
  rejectionReason?: string | null;
  capturedOffline: boolean;
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
