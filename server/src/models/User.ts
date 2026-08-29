import { Schema, model } from "mongoose";

export type Role = "owner" | "admin" | "analyst" | "member";

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
  role: { type: String, enum: ["owner", "admin", "analyst", "member"], required: true, default: "member" },
  mustChangePassword: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.String, ref: "User", default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.String, ref: "User", default: null },
});

export const User = model<UserDoc>("User", userSchema);
