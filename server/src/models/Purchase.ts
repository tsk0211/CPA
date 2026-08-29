import { Schema, model } from "mongoose";
import { UNITS } from "../units.js";

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
});

purchaseSchema.index({ projectId: 1, purchasedAt: -1 });
purchaseSchema.index({ purchasedAt: -1 });

export const Purchase = model<PurchaseDoc>("Purchase", purchaseSchema);
