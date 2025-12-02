import pino from 'pino'
import { env } from '../env'

// Pretty transport only in development (LOG_PRETTY=true)
const transport = env.LOG_PRETTY === 'true'
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    })
  : undefined

export const baseLogger = pino({
  level: env.LOG_LEVEL || 'info',
  messageKey: 'message',
}, transport)

export type Logger = typeof baseLogger

export function getLogger(module?: string, bindings?: Record<string, unknown>) {
  if (module || bindings) {
    return baseLogger.child({ module, ...(bindings || {}) })
  }
  return baseLogger
}