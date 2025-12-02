import { Hono } from "hono";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { notificationsController } from "./notifications.controller";

const notificationsRouter = new Hono();

notificationsRouter.use("/*", tenantMiddleware, authMiddleware);

notificationsRouter.post("/send", notificationsController.sendNotification);
notificationsRouter.post(
  "/send-bulk",
  notificationsController.sendBulkNotification
);
notificationsRouter.get("/in-app", notificationsController.getInAppNotifications);
notificationsRouter.patch("/in-app/:id/read", notificationsController.markInAppAsRead);
notificationsRouter.get("/in-app/unread-count", notificationsController.getUnreadCount);

notificationsRouter.get("/", notificationsController.getNotifications);
notificationsRouter.get("/:id", notificationsController.getNotificationById);
notificationsRouter.patch("/:id/read", notificationsController.markAsRead);
notificationsRouter.delete("/:id", notificationsController.deleteNotification);

notificationsRouter.get("/templates", notificationsController.getTemplates);
notificationsRouter.get(
  "/templates/:id",
  notificationsController.getTemplateById
);
notificationsRouter.post("/templates", notificationsController.createTemplate);
notificationsRouter.patch(
  "/templates/:id",
  notificationsController.updateTemplate
);
notificationsRouter.delete(
  "/templates/:id",
  notificationsController.deleteTemplate
);

notificationsRouter.post("/test-smtp", notificationsController.testSMTP);

// SSE realtime stream (optional auth)
notificationsRouter.get(
  "/realtime/sse",
  tenantMiddleware,
  notificationsController.realtimeSSE
);

export { notificationsRouter };
