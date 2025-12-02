import { Hono } from "hono";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { loggerController } from "./logger.controller";

const loggerRouter = new Hono();

loggerRouter.use("/*", tenantMiddleware, authMiddleware);

loggerRouter.post("/", loggerController.createLog);
loggerRouter.get("/", loggerController.getLogs);
loggerRouter.get("/stats", loggerController.getLogStats);
loggerRouter.get("/aggregation", loggerController.getLogAggregation);
loggerRouter.delete("/cleanup", loggerController.deleteOldLogs);

export { loggerRouter };
