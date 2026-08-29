import { optionalEnv, optionalNumber, requireEnv } from "./env.js";

// Every knob here is deliberately env-driven and defaulted, not hardcoded
// in the middleware/routes that use it — this is the one place to tighten
// (or loosen, for local dev) the app's security posture.
export const securityConfig = {
  // Secret is read fresh on each access (not cached at import time) so it
  // can be set after this module loads — required for the test harness,
  // see config/env.ts. Enforces a minimum length so a weak/default secret
  // can't accidentally ship.
  get jwtSecret(): string {
    const secret = requireEnv("JWT_SECRET");
    if (secret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32");
    }
    return secret;
  },

  // How long a login session stays valid before the app must log in again.
  jwtExpiresIn: optionalEnv("JWT_EXPIRES_IN", "30d"),

  // bcrypt cost factor. 12 is a reasonable modern default (10 is the
  // library default but considered light in 2026); each +1 roughly doubles
  // hashing time. Override BCRYPT_SALT_ROUNDS to tune cost vs. login
  // latency for the deployment target.
  bcryptSaltRounds: optionalNumber("BCRYPT_SALT_ROUNDS", 12),

  // Minimum password length enforced on account creation and password
  // changes (temp passwords included).
  minPasswordLength: optionalNumber("MIN_PASSWORD_LENGTH", 8),

  // Comma-separated list of allowed origins for browser-based clients.
  // "*" (default) is fine while the only client is the mobile app, which
  // isn't subject to CORS — tighten this the moment a web admin panel
  // exists.
  corsOrigins: optionalEnv("CORS_ORIGIN", "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Brute-force protection on /auth/login specifically. Defaults to 10
  // attempts per 15 minutes per IP.
  loginRateLimit: {
    windowMs: optionalNumber("LOGIN_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    max: optionalNumber("LOGIN_RATE_LIMIT_MAX", 10),
  },
};
