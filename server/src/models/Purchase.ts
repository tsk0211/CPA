import { Schema, model } from "mongoose";
import { UNITS } from "../units.js";

export type PurchaseStatus = "pending" | "approved" | "rejected";

export interface PurchaseDoc {
  _id: string;
  projectId: string;
  amount: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  vendor: string | null;
  category: string | null;
  notes: string | null;
  idempotencyKey: string;
  createdBy: string;
  purchasedAt: Date;
  editedBy: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  // Review workflow: a Member's purchase starts "pending" and only counts
  // toward totals/reports once an Owner/Admin approves it — the desktop
  // admin review queue is what actions this. Owner/Admin can already
  // edit/delete anything, so their own entries are auto-approved on
  // creation rather than making them review themselves.
  status: PurchaseStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  // Set when the client created this while offline and synced it later —
  // forces manual review regardless of role/auto-approve threshold, since an
  // offline entry hasn't been checked against the server's current state
  // (project still exists, threshold hasn't changed, etc.) and two devices
  // offline at once could independently log the same real-world purchase.
  // See routes/purchases.ts.
  capturedOffline: boolean;
}

const purchaseSchema = new Schema<PurchaseDoc>({
  projectId: { type: Schema.Types.String, ref: "Project", required: true },
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, default: null, min: 0 },
  unit: { type: String, enum: [...UNITS, null], default: null },
  vendor: { type: String, default: null, trim: true },
  category: { type: String, default: null, trim: true },
  notes: { type: String, default: null, trim: true },
  // Client-generated (e.g. from the offline queue's local id) so a retried
  // create — after a dropped response, or a re-synced offline item — never
  // produces a second row. See routes/purchases.ts.
  idempotencyKey: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.String, ref: "User", required: true },
  purchasedAt: { type: Date, required: true, default: () => new Date() },
  editedBy: { type: Schema.Types.String, ref: "User", default: null },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.String, ref: "User", default: null },
  status: { type: String, enum: ["pending", "approved", "rejected"], required: true, default: "pending" },
  reviewedBy: { type: Schema.Types.String, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null, trim: true },
  capturedOffline: { type: Boolean, required: true, default: false },
});

purchaseSchema.index({ projectId: 1, purchasedAt: -1 });
purchaseSchema.index({ purchasedAt: -1 });
purchaseSchema.index({ status: 1, purchasedAt: 1 });

export const Purchase = model<PurchaseDoc>("Purchase", purchaseSchema);
