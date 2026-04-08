import { Hono } from "hono";
import { db } from "../db/client";

export const apiRouter = new Hono();

// Health check
apiRouter.get("/health", async (c) => {
  // Probe DB connection
  let dbStatus: "ok" | "error" = "error";
  let dbError: string | undefined;

  try {
    await db.execute("SELECT 1");
    dbStatus = "ok";
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const status = dbStatus === "ok" ? 200 : 503;

  return c.json(
    {
      status: dbStatus === "ok" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          ...(dbError ? { error: dbError } : {}),
        },
      },
    },
    status
  );
});

// Version / app info
apiRouter.get("/info", (c) => {
  return c.json({
    name: "Iris",
    version: "0.1.0",
    description: "Self-hosted image search and organizer",
  });
});
