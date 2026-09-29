import { randomUUID } from "node:crypto";
import { Router } from "express";
import { logActivity } from "../audit.js";
import { blockIfMustChangePassword, requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import {
  DEFAULT_PERMISSIONS,
  MAX_CUSTOM_ROLE_RANK,
  MIN_CUSTOM_ROLE_RANK,
  RESERVED_ROLE_IDS,
  Role,
  type RolePermissions,
} from "../models/Role.js";
import { User } from "../models/User.js";

export const rolesRouter = Router();

rolesRouter.use(requireAuth, blockIfMustChangePassword);

// Only the fixed set of keys on RolePermissions can ever be set — this is
// what makes "a custom role can never reach manageUsers/manageRoles" true
// structurally rather than by convention: those keys simply don't exist
// here, so there's no way for a request body to smuggle them in.
function parsePermissions(input: unknown): RolePermissions {
  const body = (input ?? {}) as Record<string, unknown>;
  const permissions = { ...DEFAULT_PERMISSIONS };
  for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof RolePermissions)[]) {
    if (typeof body[key] === "boolean") permissions[key] = body[key] as boolean;
  }
  return permissions;
}

function clampRank(rank: unknown): number | null {
  if (typeof rank !== "number" || !Number.isFinite(rank)) return null;
  return Math.min(MAX_CUSTOM_ROLE_RANK, Math.max(MIN_CUSTOM_ROLE_RANK, Math.round(rank)));
}

// List + read: owner and admin both need this (admin assigns people to
// existing roles day-to-day; only owner can create/edit/delete one — see
// requireRole("owner") below on the write routes).
rolesRouter.get("/", requireRole("owner", "admin"), async (_req, res) => {
  const roles = await Role.find({ deletedAt: null }).sort({ rank: -1, name: 1 });
  res.json(roles.map(toJson));
});

rolesRouter.get("/:id", requireRole("owner", "admin"), async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, deletedAt: null });
  if (!role) return res.status(404).json({ error: "role not found" });
  res.json(toJson(role));
});

rolesRouter.post("/", requireRole("owner"), async (req: AuthedRequest, res) => {
  const { name, permissions, rank } = req.body as { name?: string; permissions?: unknown; rank?: unknown };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const clampedRank = clampRank(rank);
  if (clampedRank === null) {
    return res.status(400).json({ error: `rank is required and must be between ${MIN_CUSTOM_ROLE_RANK} and ${MAX_CUSTOM_ROLE_RANK}` });
  }

  const role = await Role.create({
    // Role._id has no auto-generator (see models/Role.ts — it's explicit
    // String so the seeded "member"/"analyst" can use readable ids), so
    // every other role needs one assigned here.
    _id: randomUUID(),
    name: name.trim(),
    permissions: parsePermissions(permissions),
    rank: clampedRank,
    createdBy: req.user!.id,
  });

  await logActivity(req, { action: "role.create", entityType: "role", entityId: role._id, after: toJson(role) });
  res.status(201).json(toJson(role));
});

rolesRouter.patch("/:id", requireRole("owner"), async (req: AuthedRequest, res) => {
  if ((RESERVED_ROLE_IDS as readonly string[]).includes(req.params.id)) {
    return res.status(403).json({ error: "owner and admin aren't editable roles" });
  }
  const role = await Role.findOne({ _id: req.params.id, deletedAt: null });
  if (!role) return res.status(404).json({ error: "role not found" });

  const { name, permissions, rank } = req.body as { name?: string; permissions?: unknown; rank?: unknown };
  const before = toJson(role);

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: "name cannot be empty" });
    role.name = name.trim();
  }
  if (permissions !== undefined) role.permissions = parsePermissions(permissions);
  if (rank !== undefined) {
    const clampedRank = clampRank(rank);
    if (clampedRank === null) {
      return res.status(400).json({ error: `rank must be between ${MIN_CUSTOM_ROLE_RANK} and ${MAX_CUSTOM_ROLE_RANK}` });
    }
    role.rank = clampedRank;
  }
  await role.save();

  await logActivity(req, { action: "role.edit", entityType: "role", entityId: role._id, before, after: toJson(role) });
  res.json(toJson(role));
});

rolesRouter.delete("/:id", requireRole("owner"), async (req: AuthedRequest, res) => {
  if ((RESERVED_ROLE_IDS as readonly string[]).includes(req.params.id)) {
    return res.status(403).json({ error: "owner and admin aren't deletable roles" });
  }
  const role = await Role.findOne({ _id: req.params.id, deletedAt: null });
  if (!role) return res.status(404).json({ error: "role not found" });

  const inUse = await User.countDocuments({ role: role._id, deletedAt: null });
  if (inUse > 0) {
    return res.status(409).json({ error: `${inUse} account(s) still have this role — reassign them first` });
  }

  role.deletedAt = new Date();
  role.deletedBy = req.user!.id;
  await role.save();

  await logActivity(req, { action: "role.delete", entityType: "role", entityId: role._id, before: toJson(role) });
  res.status(204).end();
});

function toJson(role: InstanceType<typeof Role>) {
  return { id: role._id, name: role.name, permissions: role.permissions, rank: role.rank };
}
