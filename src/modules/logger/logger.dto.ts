import { z } from "zod";

export const LogLevel = z.enum(["error", "warn", "info", "debug", "trace"]);
export type LogLevel = z.infer<typeof LogLevel>;

export const ServiceName = z.enum([
  "auth",
  "users",
  "shops",
  "services",
  "bookings",
  "notifications",
  "logger",
  "gateway",
  "api",
  "system",
]);
export type ServiceName = z.infer<typeof ServiceName>;

export const CreateLogSchema = z.object({
  level: LogLevel,
  service: ServiceName,
  message: z.string().min(1).max(1000),
  context: z.string().optional(),
  requestId: z.string().uuid().optional(),
  traceId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateLogDto = z.infer<typeof CreateLogSchema>;

export const GetLogsSchema = z.object({
  level: LogLevel.optional(),
  service: ServiceName.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().min(1).max(100).default(20),
});

export type GetLogsDto = z.infer<typeof GetLogsSchema>;

export const LogStatsSchema = z.object({
  service: ServiceName.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type LogStatsDto = z.infer<typeof LogStatsSchema>;

export const LogAggregationSchema = z.object({
  groupBy: z.enum(["level", "service", "hour", "day"]).default("day"),
  service: ServiceName.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type LogAggregationDto = z.infer<typeof LogAggregationSchema>;
