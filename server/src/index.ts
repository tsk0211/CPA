import cors from "cors";
import "dotenv/config";
import express from "express";
import { connectDb } from "./db.js";
import { auditLogRouter } from "./routes/auditLog.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { purchasesRouter } from "./routes/purchases.js";
import { usersRouter } from "./routes/users.js";
import { seedOwner } from "./seedOwner.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/projects", projectsRouter);
  app.use("/purchases", purchasesRouter);
  app.use("/users", usersRouter);
  app.use("/audit-log", auditLogRouter);

  return app;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see .env.example)");
  await connectDb(uri);
  await seedOwner();

  const app = createApp();
  const port = process.env.PORT ?? 4000;
  app.listen(port, () => console.log(`CPA server listening on http://localhost:${port}`));
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
