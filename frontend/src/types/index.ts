// "owner"/"admin" are the only two fixed literals — everything else is a
// Role document's id (server/src/models/Role.ts), including the seeded
// "member"/"analyst"/"project_manager" defaults and anything an owner
// creates later. Kept as `string` rather than a closed union now that
// roles are dynamic.
export type Role = string;

// Labels for the two literals only — a custom role's display name comes
// from the fetched Role catalog (lib/api/roles.ts), not this map. Used as
// a fallback so "owner"/"admin" render correctly even before/without that
// fetch (they're never in the fetched list, since they're not real Role
// documents).
export const roleLabel: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  // Fallback only — real deployments always have these seeded server-side
  // (seedDefaultRoles.ts), so a live roles fetch normally supplies these.
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
  description: string;
  budget: number | null;
  createdBy: string;
  createdAt: string;
  totalSpent: number;
  autoApproveThreshold: number;
}

export interface CustomRole {
  id: string;
  name: string;
  permissions: {
    manageProjects: boolean;
    addPurchases: boolean;
    editPurchases: boolean;
    reviewPurchases: boolean;
    export: boolean;
    seeActivityLog: boolean;
  };
  rank: number;
}

export interface ProjectMember {
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  roleName: string;
  assignedAt: string;
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
