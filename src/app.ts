import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";

import { authRouter } from "./modules/auth/auth.router";
import { usersRouter } from "./modules/users/users.router";
import { shopsRouter } from "./modules/shops/shops.router";
import { servicesRouter } from "./modules/services/services.router";
import { commentsRouter } from "./modules/comments/comments.router";
import { favoritesRouter } from "./modules/favorites/favorites.router";
// Webhook router kaldırıldı - artık direct API calls kullanıyoruz
import { bookingsRouter } from "./modules/bookings/bookings.router";
import { verifyEmailRouter } from "./routes/auth/verify-email.router";
import { resendVerificationRouter } from "./routes/auth/resend-verification.router";
import { notificationsRouter } from "./modules/notifications/notifications.router";
import mediaRouter from "./modules/media/media.router";
import { paymentRouter } from "./modules/payments/payments.router";
import openstreetmapRouter from "./modules/openstreetmap/openstreetmap.router";
import { loggerRouter } from "./modules/logger/logger.router";
import { publicShopsAliasRouter } from "./modules/shops/public.alias.router";
import { requestLogger } from "./core/middleware/logging";
import { AppError, toErrorResponse } from "./core/errors";
import { baseLogger, type Logger } from "./core/logging/logger";
import { docsRouter } from "./core/openapi/openapi.router";
import type { AuthUser } from "./core/clients/auth.client";
import {
  metricsMiddleware,
  getMetrics,
  getContentType,
} from "./core/observability/metrics";

const app = new Hono<{
  Variables: {
    logger: Logger;
    requestId: string;
    authUser?: AuthUser;
    userId?: string;
    userEmail?: string;
    userRole?: string;
  };
}>();

// CORS configuration (Coolify prod + local dev)
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["*"],
    exposeHeaders: ["*"],
    credentials: true,
  })
);

// Centralized request logging
app.use("*", requestLogger);
// Metrics instrumentation for all requests
app.use("*", metricsMiddleware());
// Pretty JSON responses (dev convenience)
app.use("*", prettyJSON());

app.get("/", (c) =>
  c.json({ name: "Hono + Drizzle Auth API", version: "1.0.0" })
);
app.get("/health", (c) => c.json({ ok: true }));
// Prometheus metrics endpoint
app.get("/metrics", async (c) => {
  const metrics = await getMetrics();
  return c.newResponse(metrics, 200, { "Content-Type": getContentType() });
});

// Auth router - artık backend içinde entegre
app.route("/auth", authRouter);
app.route("/auth", verifyEmailRouter);
app.route("/auth", resendVerificationRouter);
// Consolidated mounts under designated prefixes (preserve original subpaths)
app.route("/admin-barber/shops", shopsRouter);
app.route("/admin-barber/services", servicesRouter);
app.route("/admin-barber/notifications", notificationsRouter);
app.route("/customer/bookings", bookingsRouter);
app.route("/customer/favorites", favoritesRouter);
app.route("/customer/payments", paymentRouter);
app.route("/public/shops", shopsRouter);
app.route("/public/services", servicesRouter);
app.route("/public/comments", commentsRouter);
app.route("/public/media", mediaRouter);
app.route("/public/openstreetmap", openstreetmapRouter);
app.route("/super-admin/users", usersRouter);
app.route("/super-admin/logs", loggerRouter);
app.route("/super-admin/shops", shopsRouter);
app.route("/super-admin/services", servicesRouter);
app.route("/super-admin/tenants", tenantsRouter);
app.route("/super-admin/analytics", analyticsRouter);
// Webhook route kaldırıldı - artık direct API calls kullanıyoruz
app.route("/docs", docsRouter);

// Legacy alias mounts to support existing frontend without prefixes
app.route("/shops", shopsRouter);
app.route("/services", servicesRouter);
app.route("/comments", commentsRouter);
app.route("/favorites", favoritesRouter);
app.route("/bookings", bookingsRouter);
app.route("/notifications", notificationsRouter);
app.route("/users", usersRouter);
app.route("/shops", publicShopsAliasRouter);

// Centralized error handling
app.notFound((c) => {
  const reqId = c.get("requestId");
  const payload = {
    error: { code: "NOT_FOUND", message: "Route not found" },
    requestId: reqId,
  };
  return c.json(payload, 404);
});

// Restrict status codes to a known union to satisfy TS + ESLint
type AllowedStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;
function asAllowedStatus(n: number): AllowedStatus {
  switch (n) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 422:
    case 429:
    case 500:
      return n;
    default:
      return 500;
  }
}

app.onError((err, c) => {
  const logger = c.get("logger") || baseLogger;
  const reqId = c.get("requestId");
  const { status, payload } = toErrorResponse(err);
  logger.error(
    { err, requestId: reqId },
    err instanceof AppError ? err.message : "Unhandled error"
  );
  return c.json({ ...payload, requestId: reqId }, asAllowedStatus(status));
});

export default app;
import { tenantsRouter } from "./modules/superadmin/tenants.router";
import { analyticsRouter } from "./modules/superadmin/analytics.router";
