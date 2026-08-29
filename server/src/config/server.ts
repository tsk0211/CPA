import { optionalEnv, optionalNumber, requireEnv } from "./env.js";

export const serverConfig = {
  port: optionalNumber("PORT", 4000),
  nodeEnv: optionalEnv("NODE_ENV", "development"),

  // Read lazily (getter) rather than at import time: the test suite starts
  // an in-memory MongoDB and passes its URI directly to connectDb() without
  // ever setting MONGODB_URI, so this must only be evaluated by the real
  // server entrypoint, not by anything imported for testing.
  get mongoUri(): string {
    return requireEnv("MONGODB_URI");
  },
};
