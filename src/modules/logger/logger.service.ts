import { db } from "../../db";
import { logs } from "../../db/schema";
import { eq, and, gte, lte, like, desc, asc, sql, count } from "drizzle-orm";
import type {
  CreateLogDto,
  GetLogsDto,
  LogStatsDto,
  LogAggregationDto,
} from "./logger.dto";
import { getLogger } from "../../core/logging/logger";

const logger = getLogger("logger-service");

export class LoggerService {
  async createLog(data: CreateLogDto & { tenantId?: string }): Promise<void> {
    try {
      await db.insert(logs).values({
        level: data.level,
        service: data.service,
        tenantId: data.tenantId || "main",
        message: data.message,
        context: data.context,
        requestId: data.requestId,
        traceId: data.traceId,
        createdAt: new Date(),
      });

      // Aynı zamanda console'a da yaz
      this.logToConsole(data);
    } catch (error) {
      console.error("Failed to save log to database:", error);
      // Database hatası olsa bile console log'u devam etmeli
      this.logToConsole(data);
    }
  }

  async getLogs(filters: GetLogsDto & { tenantId?: string }) {
    const { level, service, startDate, endDate, search, page, limit } = filters;
    const tenantId = filters.tenantId || "main";

    const conditions = [eq(logs.tenantId, tenantId)];

    if (level) {
      conditions.push(eq(logs.level, level));
    }

    if (service) {
      conditions.push(eq(logs.service, service));
    }

    if (startDate) {
      conditions.push(gte(logs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(logs.createdAt, new Date(endDate)));
    }

    if (search) {
      conditions.push(like(logs.message, `%${search}%`));
    }

    const offset = (page - 1) * limit;

    const [logList, totalCount] = await Promise.all([
      db
        .select()
        .from(logs)
        .where(and(...conditions))
        .orderBy(desc(logs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(logs)
        .where(and(...conditions)),
    ]);

    return {
      logs: logList,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit),
      },
    };
  }

  async getLogStats(filters: LogStatsDto & { tenantId?: string }) {
    const { service, startDate, endDate } = filters;
    const tenantId = filters.tenantId || "main";

    const conditions = [eq(logs.tenantId, tenantId)];

    if (service) {
      conditions.push(eq(logs.service, service));
    }

    if (startDate) {
      conditions.push(gte(logs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(logs.createdAt, new Date(endDate)));
    }

    const [levelStats, serviceStats, totalCount] = await Promise.all([
      db
        .select({
          level: logs.level,
          count: count(),
        })
        .from(logs)
        .where(and(...conditions))
        .groupBy(logs.level)
        .orderBy(desc(count())),
      db
        .select({
          service: logs.service,
          count: count(),
        })
        .from(logs)
        .where(and(...conditions))
        .groupBy(logs.service)
        .orderBy(desc(count())),
      db
        .select({ count: count() })
        .from(logs)
        .where(and(...conditions)),
    ]);

    return {
      total: totalCount[0].count,
      levelStats: levelStats.map((s) => ({ level: s.level, count: s.count })),
      serviceStats: serviceStats.map((s) => ({
        service: s.service,
        count: s.count,
      })),
    };
  }

  async getLogAggregation(filters: LogAggregationDto & { tenantId?: string }) {
    const { groupBy, service, startDate, endDate } = filters;
    const tenantId = filters.tenantId || "main";

    const conditions = [eq(logs.tenantId, tenantId)];

    if (service) {
      conditions.push(eq(logs.service, service));
    }

    if (startDate) {
      conditions.push(gte(logs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(logs.createdAt, new Date(endDate)));
    }

    let aggregationQuery;

    switch (groupBy) {
      case "level":
        aggregationQuery = db
          .select({
            group: logs.level,
            count: count(),
          })
          .from(logs)
          .where(and(...conditions))
          .groupBy(logs.level)
          .orderBy(desc(count()));
        break;

      case "service":
        aggregationQuery = db
          .select({
            group: logs.service,
            count: count(),
          })
          .from(logs)
          .where(and(...conditions))
          .groupBy(logs.service)
          .orderBy(desc(count()));
        break;

      case "hour":
        aggregationQuery = db
          .select({
            group: sql`DATE_TRUNC('hour', ${logs.createdAt})`,
            count: count(),
          })
          .from(logs)
          .where(and(...conditions))
          .groupBy(sql`DATE_TRUNC('hour', ${logs.createdAt})`)
          .orderBy(asc(sql`DATE_TRUNC('hour', ${logs.createdAt})`));
        break;

      case "day":
      default:
        aggregationQuery = db
          .select({
            group: sql`DATE_TRUNC('day', ${logs.createdAt})`,
            count: count(),
          })
          .from(logs)
          .where(and(...conditions))
          .groupBy(sql`DATE_TRUNC('day', ${logs.createdAt})`)
          .orderBy(asc(sql`DATE_TRUNC('day', ${logs.createdAt})`));
        break;
    }

    const results = await aggregationQuery;

    return {
      groupBy,
      data: results.map((r) => ({
        group: r.group,
        count: r.count,
      })),
    };
  }

  async deleteOldLogs(
    daysToKeep: number = 30,
    tenantId?: string
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const conditions = [lte(logs.createdAt, cutoffDate)];

    if (tenantId) {
      conditions.push(eq(logs.tenantId, tenantId));
    }

    const result = await db.delete(logs).where(and(...conditions));

    const deletedCount = (result.rowCount ?? 0) as number;

    logger.info(
      `Deleted ${deletedCount} old logs older than ${daysToKeep} days`
    );

    return deletedCount;
  }

  private logToConsole(data: CreateLogDto): void {
    const logData = {
      level: data.level,
      service: data.service,
      message: data.message,
      context: data.context,
      requestId: data.requestId,
      traceId: data.traceId,
      metadata: data.metadata,
    };

    switch (data.level) {
      case "error":
        console.error("[ERROR]", logData);
        break;
      case "warn":
        console.warn("[WARN]", logData);
        break;
      case "info":
        console.info("[INFO]", logData);
        break;
      case "debug":
        console.debug("[DEBUG]", logData);
        break;
      case "trace":
        console.trace("[TRACE]", logData);
        break;
      default:
        console.log("[LOG]", logData);
    }
  }
}

export const loggerService = new LoggerService();
