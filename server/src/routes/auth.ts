import bcrypt from "bcryptjs";
import { Router } from "express";
import { securityConfig } from "../config/index.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";

export const authRouter = Router();

// No self-registration. Accounts only come from an Owner/Admin creating one
// (see routes/users.ts) with a temp password they hand to the teammate.
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await User.findOne({ email: email.toLowerCase().trim(), deletedAt: null });
  if (!user) return res.status(401).json({ error: "invalid email or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "invalid email or password" });

  const token = signToken(user._id);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
  });
});

// Used both for a forced first-login password change and a normal
// "change my password" action later — same endpoint either way.
authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < securityConfig.minPasswordLength) {
    return res
      .status(400)
      .json({ error: `currentPassword and a newPassword of at least ${securityConfig.minPasswordLength} characters are required` });
  }

  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ error: "user not found" });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "current password is incorrect" });

  user.passwordHash = await bcrypt.hash(newPassword, securityConfig.bcryptSaltRounds);
  user.mustChangePassword = false;
  await user.save();

  res.json({ ok: true });
});
