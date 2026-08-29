import bcrypt from "bcryptjs";
import { Router } from "express";
import { logActivity } from "../audit.js";
import { securityConfig } from "../config/index.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { User, type Role } from "../models/User.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.use(requireRole("owner", "admin"));

usersRouter.get("/", async (_req, res) => {
  const users = await User.find({ deletedAt: null }).select("-passwordHash").sort({ name: 1 });
  res.json(users);
});

// Owner can create admin/analyst/member. Admin can only create analyst/member.
// Nobody can create another owner through the API.
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
  if (role !== "admin" && role !== "analyst" && role !== "member") {
    return res.status(400).json({ error: "role must be 'admin', 'analyst', or 'member'" });
  }
  if (role === "admin" && req.user!.role !== "owner") {
    return res.status(403).json({ error: "only the owner can create admin accounts" });
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
  if (role !== "admin" && role !== "analyst" && role !== "member") {
    return res.status(400).json({ error: "role must be 'admin', 'analyst', or 'member'" });
  }

  const target = await User.findOne({ _id: req.params.id, deletedAt: null });
  if (!target) return res.status(404).json({ error: "user not found" });
  if (target.role === "owner") return res.status(403).json({ error: "the owner's role cannot be changed" });

  const actorIsOwner = req.user!.role === "owner";
  if (!actorIsOwner) {
    // Admin can only manage analyst/member accounts, and only into analyst/member.
    if (target.role === "admin") return res.status(403).json({ error: "only the owner can change an admin's role" });
    if (role === "admin") return res.status(403).json({ error: "only the owner can promote someone to admin" });
  }

  const before = { role: target.role };
  target.role = role;
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
  if (target._id === req.user!.id) {
    return res.status(403).json({ error: "cannot deactivate your own account" });
  }

  target.deletedAt = new Date();
  target.deletedBy = req.user!.id;
  await target.save();

  await logActivity(req, {
    action: "user.deactivate",
    entityType: "user",
    entityId: target._id,
    before: { name: target.name, email: target.email, role: target.role },
  });

  res.status(204).end();
});
