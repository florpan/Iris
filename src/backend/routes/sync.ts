import { Hono } from "hono";

export const syncRouter = new Hono();

// Placeholder — implemented by sync/indexing feature
syncRouter.get("/status", (c) => c.json({ data: { status: "idle" } }));
