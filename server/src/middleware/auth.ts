import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { securityConfig } from "../config/index.js";
import { User, type Role } from "../models/User.js";

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role; name: string; mustChangePassword: boolean };
}

export function signToken(userId: string): string {
  return jwt.sign({ id: userId }, securityConfig.jwtSecret, { expiresIn: securityConfig.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

// Looks the user up fresh on every request (rather than trusting the JWT's
// stale claims) so a deactivation or role change takes effect immediately,
// not after a 30-day-old token expires.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "missing bearer token" });

  try {
    const decoded = jwt.verify(token, securityConfig.jwtSecret) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user || user.deletedAt) return res.status(401).json({ error: "account not found or deactivated" });

    req.user = { id: user._id, role: user.role, name: user.name, mustChangePassword: user.mustChangePassword };
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

// Blocks access to normal app routes until a first-login temp password has
// been replaced. Not applied to /auth/change-password itself.
export function blockIfMustChangePassword(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: "must change password before continuing", code: "MUST_CHANGE_PASSWORD" });
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `requires one of: ${roles.join(", ")}` });
    }
    next();
  };
}
