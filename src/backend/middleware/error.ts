import type { Context } from "hono";

/**
 * Global error handler for Hono — catches all unhandled errors in API routes
 * and returns a consistent JSON error response.
 */
export function errorHandler(err: Error, c: Context): Response {
  console.error(`[error] ${c.req.method} ${c.req.url}`, err);

  // HTTPException from Hono has a getResponse() method
  if ("getResponse" in err && typeof (err as any).getResponse === "function") {
    const honoErr = err as any;
    const response = honoErr.getResponse() as Response;
    const status = response.status as
      | 400
      | 401
      | 403
      | 404
      | 409
      | 422
      | 500
      | 503;
    return c.json({ error: honoErr.message || "Request failed" }, status);
  }

  // Generic error — return 500
  return c.json({ error: err.message || "Internal server error" }, 500);
}

/**
 * Not-found handler — returns a JSON 404 for unmatched API routes.
 */
export function notFoundHandler(c: Context): Response {
  return c.json({ error: `Not found: ${c.req.path}` }, 404);
}
