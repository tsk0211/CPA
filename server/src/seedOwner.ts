import bcrypt from "bcryptjs";
import { User } from "./models/User.js";

// The Owner is a singleton created only here, from env vars, the first time
// the server ever boots against a fresh database — never through the API.
// That's what guarantees there is always exactly one and it can't be spun
// up by anyone else.
export async function seedOwner() {
  const existingOwner = await User.findOne({ role: "owner" });
  if (existingOwner) return;

  const name = process.env.OWNER_NAME;
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!name || !email || !password) {
    throw new Error("No owner exists yet — set OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD to seed one on first boot");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: "owner",
    mustChangePassword: true,
    createdBy: null,
  });
  console.log(`Seeded owner account: ${email}`);
}
