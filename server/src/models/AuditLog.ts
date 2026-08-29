import { Schema, model } from "mongoose";

export type AuditAction =
  | "project.create"
  | "project.rename"
  | "project.delete"
  | "purchase.create"
  | "purchase.edit"
  | "purchase.delete"
  | "user.create"
  | "user.role_change"
  | "user.deactivate";

export interface AuditLogDoc {
  _id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  entityType: "project" | "purchase" | "user";
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>({
  actorId: { type: Schema.Types.String, ref: "User", required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
