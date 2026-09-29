import { DEFAULT_PERMISSIONS, Role } from "./models/Role.js";

// "member" and "analyst" used to be hardcoded literals alongside "owner"
// and "admin" — now that roles are dynamic (Role collection), they're just
// the two default rows every deployment starts with. Seeded with these
// exact ids so every existing User.role value already in the database
// ("member" / "analyst" strings) keeps resolving correctly with zero data
// migration — this only ever inserts, never touches existing User docs.
const DEFAULT_ROLES: { _id: string; name: string; permissions: typeof DEFAULT_PERMISSIONS; rank: number }[] = [
  {
    _id: "member",
    name: "Member",
    permissions: { ...DEFAULT_PERMISSIONS, addPurchases: true },
    rank: 10,
  },
  {
    _id: "analyst",
    name: "Analyst",
    permissions: { ...DEFAULT_PERMISSIONS, export: true, seeActivityLog: true },
    rank: 20,
  },
  // Assigned per-project (see models/ProjectMember.ts), not globally like
  // the two above — a "Project Manager" reviews purchases and can log
  // their own, but the actual PM-first review pipeline (member -> PM ->
  // admin) isn't wired up yet; this seeds the role itself so it exists to
  // assign today, ahead of that. Rank sits well below admin (100).
  {
    _id: "project_manager",
    name: "Project Manager",
    permissions: { ...DEFAULT_PERMISSIONS, addPurchases: true, reviewPurchases: true },
    rank: 50,
  },
];

export async function seedDefaultRoles() {
  for (const role of DEFAULT_ROLES) {
    const existing = await Role.findById(role._id);
    if (existing) continue;
    await Role.create({ ...role, createdBy: null });
    console.log(`Seeded default role: ${role.name}`);
  }
}
