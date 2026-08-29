import "dotenv/config";

// Small helpers so every other config file reads env vars the same way.
// Deliberately NOT eager/validated at module-load time for required vars —
// the test suite spins up a database and sets secrets at runtime, after
// this module is first imported, so validation has to happen lazily
// (only when a value is actually read) rather than at import time.

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) throw new Error(`Env var ${name} must be a number, got "${raw}"`);
  return parsed;
}
