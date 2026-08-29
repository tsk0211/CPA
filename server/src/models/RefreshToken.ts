import { Schema, model } from "mongoose";

export interface RefreshTokenDoc {
  _id: string;
  userId: string;
  tokenHash: string;
  rememberMe: boolean;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  replacedByHash: string | null;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>({
  userId: { type: Schema.Types.String, ref: "User", required: true },
  // Only the SHA-256 hash is ever stored — the raw token exists only in the
  // client's secure storage and in the one response that issued it. A DB
  // leak alone can't be used to impersonate a session.
  tokenHash: { type: String, required: true, unique: true },
  rememberMe: { type: Boolean, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
});

refreshTokenSchema.index({ userId: 1 });

export const RefreshToken = model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
