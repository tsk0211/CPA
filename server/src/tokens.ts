import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { securityConfig } from "./config/index.js";
import { RefreshToken } from "./models/RefreshToken.js";

export function signAccessToken(userId: string): string {
  return jwt.sign({ id: userId }, securityConfig.jwtSecret, {
    expiresIn: securityConfig.accessTokenExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): { id: string } {
  return jwt.verify(token, securityConfig.jwtSecret) as { id: string };
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Issues a brand new refresh token for a user (used at login). Returns the
// raw token — the only time it's ever available in plaintext — for the
// client to store; the DB only ever keeps its hash.
export async function issueRefreshToken(userId: string, rememberMe: boolean): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const ttlDays = rememberMe ? securityConfig.refreshTokenTtlDays.rememberMe : securityConfig.refreshTokenTtlDays.default;

  await RefreshToken.create({
    userId,
    tokenHash: hashToken(rawToken),
    rememberMe,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  });

  return rawToken;
}

export type RefreshResult =
  | { ok: true; userId: string; newRawToken: string }
  | { ok: false; reason: "not_found" | "expired" | "reused" };

// Validates a presented refresh token and rotates it: the old one is
// revoked, a new one is issued in its place. If a token that was already
// revoked gets presented again, that's a signal it was copied/stolen and
// replayed — every refresh token for that user is revoked immediately as a
// containment measure, forcing a fresh login everywhere.
export async function rotateRefreshToken(rawToken: string): Promise<RefreshResult> {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) return { ok: false, reason: "not_found" };

  if (existing.revokedAt) {
    await RefreshToken.updateMany({ userId: existing.userId, revokedAt: null }, { revokedAt: new Date() });
    return { ok: false, reason: "reused" };
  }

  if (existing.expiresAt < new Date()) {
    return { ok: false, reason: "expired" };
  }

  const newRawToken = crypto.randomBytes(40).toString("hex");
  const newHash = hashToken(newRawToken);
  const ttlDays = existing.rememberMe ? securityConfig.refreshTokenTtlDays.rememberMe : securityConfig.refreshTokenTtlDays.default;

  await RefreshToken.create({
    userId: existing.userId,
    tokenHash: newHash,
    rememberMe: existing.rememberMe,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  });

  existing.revokedAt = new Date();
  existing.replacedByHash = newHash;
  await existing.save();

  return { ok: true, userId: existing.userId, newRawToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne({ tokenHash: hashToken(rawToken), revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}
