import { Schema, model } from "mongoose";

export interface PurchaseDoc {
  _id: string;
  projectId: string;
  amount: number;
  description: string;
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
