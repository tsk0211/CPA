import { Schema, model } from "mongoose";

export interface ProjectDoc {
  _id: string;
  name: string;
  icon: string;
  createdBy: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}

const projectSchema = new Schema<ProjectDoc>({
  name: { type: String, required: true, trim: true },
  icon: { type: String, required: true, default: "📁" },
  createdBy: { type: Schema.Types.String, ref: "User", required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.String, ref: "User", default: null },
});

export const Project = model<ProjectDoc>("Project", projectSchema);
