import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { apiRouter } from "./routes/api";
import { runStartup } from "./lib/startup";

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

// Run startup validation and folder setup before serving requests
runStartup().then((result) => {
  if (result.fatalError) {
    console.error(`[startup] Fatal error — server may not function correctly: ${result.fatalError}`);
  }
  if (result.warnings.length > 0) {
    console.warn(`[startup] ${result.warnings.length} warning(s) during startup`);
  }
});

console.log(`🌸 Iris server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
