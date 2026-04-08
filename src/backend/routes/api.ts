import { Hono } from "hono";
import { errorHandler } from "../middleware/error";
import { healthRouter } from "./health";
import { configRouter } from "./config";
import { sourcesRouter } from "./sources";
import { imagesRouter } from "./images";
import { foldersRouter } from "./folders";
import { tagsRouter } from "./tags";
import { syncRouter } from "./sync";
import { statsRouter } from "./stats";
import { thumbnailsRouter } from "./thumbnails";
import { searchRouter } from "./search";
import { facetsRouter } from "./facets";
import { timelineRouter } from "./timeline";

export const apiRouter = new Hono();

// Global error handler for all API routes
apiRouter.onError(errorHandler);

// ── Route Groups ────────────────────────────────────────────────────────────
apiRouter.route("/health", healthRouter);
apiRouter.route("/config", configRouter);
apiRouter.route("/sources", sourcesRouter);
apiRouter.route("/images", imagesRouter);
apiRouter.route("/folders", foldersRouter);
apiRouter.route("/tags", tagsRouter);
apiRouter.route("/sync", syncRouter);
apiRouter.route("/stats", statsRouter);
apiRouter.route("/thumbnails", thumbnailsRouter);
apiRouter.route("/search", searchRouter);
apiRouter.route("/facets", facetsRouter);
apiRouter.route("/timeline", timelineRouter);
