import { getLogger, type Logger } from "../../../core/logging/logger";
import { loggerService } from "../logger.service";
import type { LogLevel, ServiceName } from "../logger.dto";

export interface EnhancedLogger extends Logger {
  logToDatabase: (
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  logWithContext: (
    level: LogLevel,
    message: string,
    context: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
}

export function getEnhancedLogger(
  service: ServiceName,
  bindings?: Record<string, unknown>
): EnhancedLogger {
  const baseLogger = getLogger(service, bindings);

  const enhancedLogger = baseLogger as EnhancedLogger;

  // Database logging method
  enhancedLogger.logToDatabase = async (
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      const _tenantId = (bindings?.tenantId as string) || "main";
      const requestId = bindings?.requestId as string;
      const traceId = bindings?.traceId as string;

      await loggerService.createLog({
        level,
        service,
        message,
        context,
        requestId,
        traceId,
        metadata,
      });
    } catch (error) {
      // Database logging hatası durumunda sadece console'a yaz
      baseLogger.error(
        { error, service, message, context, metadata },
        "Failed to log to database"
      );
    }
  };

  // Context logging method
  enhancedLogger.logWithContext = async (
    level: LogLevel,
    message: string,
    context: string,
    metadata?: Record<string, unknown>
  ) => {
    // Console logging
    switch (level) {
      case "error":
        baseLogger.error({ context, metadata, service }, message);
        break;
      case "warn":
        baseLogger.warn({ context, metadata, service }, message);
        break;
      case "info":
        baseLogger.info({ context, metadata, service }, message);
        break;
      case "debug":
        baseLogger.debug({ context, metadata, service }, message);
        break;
      case "trace":
        baseLogger.trace({ context, metadata, service }, message);
        break;
    }

    // Database logging
    await enhancedLogger.logToDatabase(level, message, context, metadata);
  };

  return enhancedLogger;
}

// Convenience functions for different log levels
export async function logError(
  service: ServiceName,
  message: string,
  error?: unknown,
  context?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const logger = getEnhancedLogger(service, metadata);
  const errorMetadata = {
    ...metadata,
    error:
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error,
  };
  await logger.logWithContext(
    "error",
    message,
    context || "error",
    errorMetadata
  );
}

export async function logWarn(
  service: ServiceName,
  message: string,
  context?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const logger = getEnhancedLogger(service, metadata);
  await logger.logWithContext("warn", message, context || "warning", metadata);
}

export async function logInfo(
  service: ServiceName,
  message: string,
  context?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const logger = getEnhancedLogger(service, metadata);
  await logger.logWithContext("info", message, context || "info", metadata);
}

export async function logDebug(
  service: ServiceName,
  message: string,
  context?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const logger = getEnhancedLogger(service, metadata);
  await logger.logWithContext("debug", message, context || "debug", metadata);
}

export async function logTrace(
  service: ServiceName,
  message: string,
  context?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const logger = getEnhancedLogger(service, metadata);
  await logger.logWithContext("trace", message, context || "trace", metadata);
}
