import bcrypt from "bcryptjs";
import { Router } from "express";
import { logActivity } from "../audit.js";
import { securityConfig } from "../config/index.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Role as RoleDoc } from "../models/Role.js";
import { User, type Role } from "../models/User.js";
import { parsePageParams, searchFilter, toPagedResult } from "../pagination.js";
import { revokeAllRefreshTokensForUser } from "../tokens.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.use(requireRole("owner", "admin"));

usersRouter.get("/", async (req, res) => {
  const pageParams = parsePageParams(req);
  const filter = { deletedAt: null, ...(searchFilter("name", req.query.search) ?? {}) };

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select("-passwordHash")
    .sort({ name: 1 })
    .skip(pageParams.skip)
    .limit(pageParams.limit);

  res.json(toPagedResult(users, total, pageParams));
});

// Owner can create admin accounts or assign any existing (custom) role.
// Admin can only assign an existing non-admin role. Nobody can create
// another owner through the API.
usersRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, email, tempPassword, role } = req.body as {
    name?: string;
    email?: string;
    tempPassword?: string;
    role?: Role;
  };
  if (!name?.trim() || !email?.trim() || !tempPassword || tempPassword.length < securityConfig.minPasswordLength) {
    return res
      .status(400)
      .json({ error: `name, email, and a tempPassword of at least ${securityConfig.minPasswordLength} characters are required` });
  }
  if (role === "admin") {
    if (req.user!.role !== "owner") return res.status(403).json({ error: "only the owner can create admin accounts" });
  } else {
    const roleExists = role ? await RoleDoc.exists({ _id: role, deletedAt: null }) : null;
    if (!roleExists) return res.status(400).json({ error: "role must be 'admin' or an existing role id" });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ error: "an account with this email already exists" });

  const passwordHash = await bcrypt.hash(tempPassword, securityConfig.bcryptSaltRounds);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    mustChangePassword: true,
    createdBy: req.user!.id,
  });

  await logActivity(req, {
    action: "user.create",
    entityType: "user",
    entityId: user._id,
    after: { name: user.name, email: user.email, role: user.role },
  });

  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

usersRouter.patch("/:id/role", async (req: AuthedRequest, res) => {
  const { role } = req.body as { role?: Role };
  if (role === "admin") {
    if (req.user!.role !== "owner") return res.status(403).json({ error: "only the owner can promote someone to admin" });
  } else {
    const roleExists = role ? await RoleDoc.exists({ _id: role, deletedAt: null }) : null;
    if (!roleExists) return res.status(400).json({ error: "role must be 'admin' or an existing role id" });
  }

  const target = await User.findOne({ _id: req.params.id, deletedAt: null });
  if (!target) return res.status(404).json({ error: "user not found" });
  if (target.role === "owner") return res.status(403).json({ error: "the owner's role cannot be changed" });

  const actorIsOwner = req.user!.role === "owner";
  if (!actorIsOwner && target.role === "admin") {
    // Admin can manage any non-admin account into any existing non-admin
    // role, but can't touch another admin's role at all.
    return res.status(403).json({ error: "only the owner can change an admin's role" });
  }

  const before = { role: target.role };
  target.role = role!;
  await target.save();

  await logActivity(req, {
    action: "user.role_change",
    entityType: "user",
    entityId: target._id,
    before,
    after: { role: target.role },
  });

  res.json({ id: target._id, name: target.name, email: target.email, role: target.role });
});

usersRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const target = await User.findOne({ _id: req.params.id, deletedAt: null });
  if (!target) return res.status(404).json({ error: "user not found" });
  if (target.role === "owner") return res.status(403).json({ error: "the owner cannot be deactivated" });

  const actorIsOwner = req.user!.role === "owner";
  if (!actorIsOwner && target.role === "admin") {
    return res.status(403).json({ error: "only the owner can deactivate an admin" });
  }
  // target._id is a live Mongoose ObjectId here, not the plain string the
  // JWT carries — strict equality against req.user!.id would silently
  // never match (pre-existing bug found while touching this route: the
  // "can't deactivate yourself" guard never actually fired).
  if (String(target._id) === req.user!.id) {
    return res.status(403).json({ error: "cannot deactivate your own account" });
  }

  target.deletedAt = new Date();
  target.deletedBy = req.user!.id;
  await target.save();
  await revokeAllRefreshTokensForUser(target._id);

  await logActivity(req, {
    action: "user.deactivate",
    entityType: "user",
    entityId: target._id,
    before: { name: target.name, email: target.email, role: target.role },
  });

  res.status(204).end();
});
