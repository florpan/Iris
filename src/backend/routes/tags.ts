import { Hono } from "hono";

export const tagsRouter = new Hono();

// Placeholder — implemented by tagging feature
tagsRouter.get("/", (c) => c.json({ data: [] }));
