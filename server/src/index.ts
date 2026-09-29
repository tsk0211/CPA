// Must be imported before any router below is defined — it patches
// Express's Router methods so a rejected promise inside an async handler
// (e.g. a Mongoose CastError from a malformed :id) is forwarded to the
// error-handling middleware instead of becoming an unhandled rejection
// that crashes the whole process (Express 4 doesn't catch these itself).
import "express-async-errors";

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { appConfig, securityConfig, serverConfig } from "./config/index.js";
import { connectDb } from "./db.js";
import { InvalidDateError } from "./dateFilter.js";
import { auditLogRouter } from "./routes/auditLog.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { purchasesRouter } from "./routes/purchases.js";
import { usersRouter } from "./routes/users.js";
import { seedOwner } from "./seedOwner.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: securityConfig.corsOrigins.includes("*") ? true : securityConfig.corsOrigins,
    }),
  );
  app.use(express.json());

  const loginLimiter = rateLimit({
    windowMs: securityConfig.loginRateLimit.windowMs,
    limit: securityConfig.loginRateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too many login attempts, try again later" },
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));
  // Public, unauthenticated, cacheable app-display config — currency code
  // today, anything else both clients need without hardcoding/guessing from
  // locale later. See config/app.ts.
  app.get("/config", (_req, res) => res.json({ currencyCode: appConfig.currencyCode }));
  app.use("/auth/login", loginLimiter);
  app.use("/auth", authRouter);
  app.use("/projects", projectsRouter);
  app.use("/purchases", purchasesRouter);
  app.use("/users", usersRouter);
  app.use("/audit-log", auditLogRouter);

  // Last resort: turns a thrown/rejected error from any route into a JSON
  // response instead of an unhandled rejection. A malformed :id (client
  // typo'd link, stale cache) is a CastError and is the client's fault, not
  // a server failure — reported as 400 rather than a generic 500.
  const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.name === "CastError") return void res.status(400).json({ error: "invalid id" });
    if (err instanceof InvalidDateError) return void res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  };
  app.use(errorHandler);

  return app;
}

async function main() {
  await connectDb(serverConfig.mongoUri);
  await seedOwner();

  const app = createApp();
  app.listen(serverConfig.port, () => console.log(`CPA server listening on http://localhost:${serverConfig.port}`));
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
