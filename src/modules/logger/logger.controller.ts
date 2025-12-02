import type { Context } from "hono";
import { z } from "zod";
import { loggerService } from "./logger.service";
import {
  CreateLogSchema,
  GetLogsSchema,
  LogStatsSchema,
  LogAggregationSchema,
} from "./logger.dto";
import { HTTPException } from "hono/http-exception";

export class LoggerController {
  async createLog(c: Context) {
    try {
      const role = String(c.get("userRole") ?? "");
      if (role === "customer") {
        throw new HTTPException(403, { message: "Forbidden" });
      }
      const body = await c.req.json();
      const validatedData = CreateLogSchema.parse(body);
      const tenantId = c.get("tenantId");

      await loggerService.createLog({
        ...validatedData,
        tenantId,
      });

      return c.json({
        success: true,
        message: "Log created successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: "Validation error",
          cause: error,
        });
      }
      throw error;
    }
  }

  async getLogs(c: Context) {
    try {
      const role = String(c.get("userRole") ?? "");
      if (role === "customer") {
        throw new HTTPException(403, { message: "Forbidden" });
      }
      const query = c.req.query();
      const validatedData = GetLogsSchema.parse(query);
      const tenantId = c.get("tenantId");

      const result = await loggerService.getLogs({
        ...validatedData,
        tenantId,
      });

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: "Validation error",
          cause: error,
        });
      }
      throw error;
    }
  }

  async getLogStats(c: Context) {
    try {
      const role = String(c.get("userRole") ?? "");
      if (role === "customer") {
        throw new HTTPException(403, { message: "Forbidden" });
      }
      const query = c.req.query();
      const validatedData = LogStatsSchema.parse(query);
      const tenantId = c.get("tenantId");

      const result = await loggerService.getLogStats({
        ...validatedData,
        tenantId,
      });

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: "Validation error",
          cause: error,
        });
      }
      throw error;
    }
  }

  async getLogAggregation(c: Context) {
    try {
      const role = String(c.get("userRole") ?? "");
      if (role === "customer") {
        throw new HTTPException(403, { message: "Forbidden" });
      }
      const query = c.req.query();
      const validatedData = LogAggregationSchema.parse(query);
      const tenantId = c.get("tenantId");

      const result = await loggerService.getLogAggregation({
        ...validatedData,
        tenantId,
      });

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, {
          message: "Validation error",
          cause: error,
        });
      }
      throw error;
    }
  }

  async deleteOldLogs(c: Context) {
    try {
      const role = String(c.get("userRole") ?? "");
      if (role === "customer") {
        throw new HTTPException(403, { message: "Forbidden" });
      }
      const body = await c.req.json();
      const { daysToKeep = 30 } = body;
      const tenantId = c.get("tenantId");

      const deletedCount = await loggerService.deleteOldLogs(
        daysToKeep,
        tenantId
      );

      return c.json({
        success: true,
        data: { deletedCount },
      });
    } catch (error) {
      throw error;
    }
  }
}

export const loggerController = new LoggerController();
