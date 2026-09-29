import { Schema, model } from "mongoose";

export interface ProjectDoc {
  _id: string;
  name: string;
  icon: string;
  description: string;
  // A target/cap to compare totalSpent against on the detail page —
  // distinct from autoApproveThreshold below (that's a review-skip cutoff
  // per purchase, this is the project's own overall number). Null means
  // "no budget set," not zero.
  budget: number | null;
  createdBy: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  // A Member's purchase at or under this amount is auto-approved instead of
  // entering the review queue — see routes/purchases.ts. Defaults to 0
  // (nothing auto-approves) so a new project doesn't silently skip review
  // until an Owner/Admin deliberately raises it.
  autoApproveThreshold: number;
}

const projectSchema = new Schema<ProjectDoc>({
  name: { type: String, required: true, trim: true },
  icon: { type: String, required: true, default: "📁" },
  // Not `required: true` — Mongoose's built-in required validator for
  // String paths fails on an empty string, not just undefined/null, which
  // is exactly wrong for an optional free-text field defaulting to "".
  description: { type: String, default: "", trim: true },
  budget: { type: Number, default: null, min: 0 },
  createdBy: { type: Schema.Types.String, ref: "User", required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.String, ref: "User", default: null },
  autoApproveThreshold: { type: Number, required: true, default: 0, min: 0 },
});

export const Project = model<ProjectDoc>("Project", projectSchema);
