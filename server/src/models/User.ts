import { Schema, model } from "mongoose";

// "owner" and "admin" are the only two literal values — everything else is
// a Role document's _id (see models/Role.ts), including the seeded
// "member"/"analyst" defaults. Kept as `string` rather than a closed union
// now that roles are dynamic; RESERVED_ROLE_IDS in models/Role.ts is the
// source of truth for the two literals.
export type Role = string;

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  mustChangePassword: boolean;
  createdBy: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}

const userSchema = new Schema<UserDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  // No `enum` here anymore — validity (must be "admin"/"owner" or an
  // existing, non-deleted Role document) is enforced at the route layer
  // (routes/users.ts), where a real DB lookup is possible.
  role: { type: String, required: true, default: "member" },
  mustChangePassword: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.String, ref: "User", default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.String, ref: "User", default: null },
});

export const User = model<UserDoc>("User", userSchema);
