export interface OwnerSeed {
  name: string;
  email: string;
  password: string;
}

// Returns null (rather than throwing) when unset, so the caller — only
// seedOwner.ts, only on first boot — can give one combined, friendly error
// instead of failing on whichever var happens to be checked first.
export function loadOwnerSeed(): OwnerSeed | null {
  const name = process.env.OWNER_NAME;
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!name || !email || !password) return null;
  return { name, email, password };
}
