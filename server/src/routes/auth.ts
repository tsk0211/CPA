import bcrypt from "bcryptjs";
import { Router } from "express";
import { securityConfig } from "../config/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from "../tokens.js";

export const authRouter = Router();

// No self-registration. Accounts only come from an Owner/Admin creating one
// (see routes/users.ts) with a temp password they hand to the teammate.
authRouter.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body as { email?: string; password?: string; rememberMe?: boolean };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await User.findOne({ email: email.toLowerCase().trim(), deletedAt: null });
  if (!user) return res.status(401).json({ error: "invalid email or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "invalid email or password" });

  const accessToken = signAccessToken(user._id);
  const refreshToken = await issueRefreshToken(user._id, Boolean(rememberMe));

  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
  });
});

// Exchanges a still-valid refresh token for a new access token, rotating
// the refresh token in the process (old one revoked, new one issued) —
// see src/tokens.ts for the reuse-detection this enables.
authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

  const result = await rotateRefreshToken(refreshToken);
  if (!result.ok) {
    const messages = {
      not_found: "unknown refresh token",
      expired: "refresh token expired, please log in again",
      reused: "refresh token was already used — all sessions for this account have been signed out as a precaution",
    };
    return res.status(401).json({ error: messages[result.reason] });
  }

  const user = await User.findById(result.userId);
  if (!user || user.deletedAt) return res.status(401).json({ error: "account not found or deactivated" });

  res.json({ accessToken: signAccessToken(user._id), refreshToken: result.newRawToken });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.status(204).end();
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
