import { Schema, model } from "mongoose";

// Who's assigned to a project, and with what role — distinct from a
// user's global role (models/User.ts/Role.ts). A person can be a plain
// Member globally but "Project Manager" on this one project, or on
// several. Append-only with revokedAt rather than deleted/overwritten in
// place, same soft-delete convention as everywhere else in this app —
// people get swapped on and off projects, and "who was PM of Project X in
// March" should stay answerable.
export interface ProjectMemberDoc {
  _id: string;
  projectId: string;
  userId: string;
  // References a Role document's _id (models/Role.ts) — never "owner" or
  // "admin": those are global, not something you're "assigned to a
  // project" for. Enforced at the route layer (routes/projects.ts).
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

const projectMemberSchema = new Schema<ProjectMemberDoc>({
  projectId: { type: Schema.Types.String, ref: "Project", required: true },
  userId: { type: Schema.Types.String, ref: "User", required: true },
  roleId: { type: Schema.Types.String, ref: "Role", required: true },
  assignedBy: { type: Schema.Types.String, ref: "User", required: true },
  assignedAt: { type: Date, required: true, default: () => new Date() },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: Schema.Types.String, ref: "User", default: null },
});

projectMemberSchema.index({ projectId: 1, userId: 1 });

export const ProjectMember = model<ProjectMemberDoc>("ProjectMember", projectMemberSchema);
