import { Hono } from "hono";
import { db } from "../db/client";

export const healthRouter = new Hono();

// GET /api/health — server + database status
healthRouter.get("/", async (c) => {
  let dbStatus: "ok" | "error" = "error";
  let dbError: string | undefined;

  try {
    await db.execute("SELECT 1");
    dbStatus = "ok";
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const httpStatus = dbStatus === "ok" ? 200 : 503;

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
    httpStatus
  );
});
