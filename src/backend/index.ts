import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { apiRouter } from "./routes/api";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);

// API routes
app.route("/api", apiRouter);

// Serve static frontend (built by Vite)
const publicDir = process.env.PUBLIC_DIR ?? "./dist/public";
app.use("/*", serveStatic({ root: publicDir }));

// SPA fallback — serve index.html for all unmatched routes
app.get("*", serveStatic({ path: `${publicDir}/index.html` }));

const port = Number(process.env.PORT ?? 3000);

console.log(`🌸 Iris server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
