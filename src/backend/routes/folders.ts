import { Hono } from "hono";

export const foldersRouter = new Hono();

// Placeholder — implemented by folder-navigation feature
foldersRouter.get("/", (c) => c.json({ data: [] }));
