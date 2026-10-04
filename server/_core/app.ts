import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { rateLimit } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { validateServerConfig } from "./env.js";
import { sameOrigin } from "./security.js";
import { registerStorageRoutes } from "./storageRoutes.js";
import { createContext } from "./context.js";
import { getDb } from "../db.js";
import { ensureDemoReports } from "../civicDb.js";
import { appRouter } from "../routers.js";

let databaseReady: Promise<void> | undefined;
export function initializeDatabase() {
  databaseReady ??= (async () => {
    const database = await getDb();
    await database.execute(sql`SELECT 1`);
    await ensureDemoReports();
  })().catch(error => {
    databaseReady = undefined;
    throw error;
  });
  return databaseReady;
}

export function createApp(serverless = false) {
  const config = validateServerConfig();
  if (serverless && config.STORAGE_DRIVER !== "s3") {
    throw new Error(
      "Vercel requires STORAGE_DRIVER=s3; function files are not persistent."
    );
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(async (_req, _res, next) => {
    try {
      await initializeDatabase();
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", sameOrigin);
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    })
  );
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.use("/api/trpc", (req, res, next) => {
    if (req.path.split(",").some(path => /auth\.(login|register)/.test(path)))
      return authLimiter(req, res, next);
    next();
  });
  app.use(express.json({ limit: serverless ? "1mb" : "7mb" }));
  app.use(
    express.urlencoded({ limit: serverless ? "1mb" : "7mb", extended: true })
  );
  registerStorageRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[CivicFix] Request failed:", error);
      if (!res.headersSent)
        res.status(500).json({ error: "The request could not be completed." });
    }
  );
  return app;
}
