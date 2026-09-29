import { Schema, model } from "mongoose";

// "owner" and "admin" are NOT rows in this collection — they're literal
// string values on User.role, hardcoded everywhere they're checked
// (requireRole("owner", "admin"), etc.) and never editable through the API.
// This collection is exclusively the dynamic floor beneath them: every
// other role (the seeded "member"/"analyst" defaults, and anything an
// Owner creates later — "Project Manager" and whatever else a company
// needs) is a document here.
export const RESERVED_ROLE_IDS = ["owner", "admin"] as const;

// Ranks are just an ordering/ceiling check, not a permission source of
// truth — a custom role's actual power comes from `permissions` below.
// Clamped so nothing dynamic can claim to outrank admin.
export const ADMIN_RANK = 100;
export const MAX_CUSTOM_ROLE_RANK = ADMIN_RANK - 1;
export const MIN_CUSTOM_ROLE_RANK = 0;

// Deliberately does NOT include "manageUsers" or "manageRoles" — those stay
// exclusive to the owner/admin literals by construction: there is no key a
// custom role's permissions object could ever set to grant them. This is
// the actual enforcement behind "no dynamic role can replace admin/owner",
// not just the rank ceiling above.
export interface RolePermissions {
  manageProjects: boolean;
  addPurchases: boolean;
  editPurchases: boolean;
  reviewPurchases: boolean;
  export: boolean;
  seeActivityLog: boolean;
}

export const DEFAULT_PERMISSIONS: RolePermissions = {
  manageProjects: false,
  addPurchases: false,
  editPurchases: false,
  reviewPurchases: false,
  export: false,
  seeActivityLog: false,
};

export interface RoleDoc {
  _id: string;
  name: string;
  permissions: RolePermissions;
  rank: number;
  createdBy: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}

const permissionsSchema = new Schema<RolePermissions>(
  {
    manageProjects: { type: Boolean, required: true, default: false },
    addPurchases: { type: Boolean, required: true, default: false },
    editPurchases: { type: Boolean, required: true, default: false },
    reviewPurchases: { type: Boolean, required: true, default: false },
    export: { type: Boolean, required: true, default: false },
    seeActivityLog: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const roleSchema = new Schema<RoleDoc>({
  // Explicit String _id (Mongoose defaults to auto-generated ObjectId
  // otherwise) — needed so the seeded defaults can use human-readable ids
  // ("member", "analyst") that match the string values already sitting in
  // every existing User.role field, with zero data migration required. A
  // custom role created later through the API just gets a random string id
  // (see routes/roles.ts) — nothing requires ids to be readable in general.
  _id: { type: String },
  name: { type: String, required: true, trim: true },
  permissions: { type: permissionsSchema, required: true, default: () => ({ ...DEFAULT_PERMISSIONS }) },
  rank: { type: Number, required: true, min: MIN_CUSTOM_ROLE_RANK, max: MAX_CUSTOM_ROLE_RANK },
  createdBy: { type: Schema.Types.String, ref: "User", default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.String, ref: "User", default: null },
});

export const Role = model<RoleDoc>("Role", roleSchema);
