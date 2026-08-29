import bcrypt from "bcryptjs";
import { loadOwnerSeed, securityConfig } from "./config/index.js";
import { User } from "./models/User.js";

// The Owner is a singleton created only here, from env vars, the first time
// the server ever boots against a fresh database — never through the API.
// That's what guarantees there is always exactly one and it can't be spun
// up by anyone else.
export async function seedOwner() {
  const existingOwner = await User.findOne({ role: "owner" });
  if (existingOwner) return;

  const seed = loadOwnerSeed();
  if (!seed) {
    throw new Error("No owner exists yet — set OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD to seed one on first boot");
  }

  const passwordHash = await bcrypt.hash(seed.password, securityConfig.bcryptSaltRounds);
  await User.create({
    name: seed.name,
    email: seed.email.toLowerCase().trim(),
    passwordHash,
    role: "owner",
    mustChangePassword: true,
    createdBy: null,
  });
  console.log(`Seeded owner account: ${seed.email}`);
}
