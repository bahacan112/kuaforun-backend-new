import client from 'prom-client'
import type { Context, Next } from 'hono'

// Service name label for metrics
const SERVICE_NAME = process.env.SERVICE_NAME || 'kuaforun-backend'

// Single registry for the app
const register = new client.Registry()
client.collectDefaultMetrics({ register })

// HTTP metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['service', 'method', 'route', 'status_code'],
  registers: [register],
})

const httpRequestErrorsTotal = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP error responses (>=500)',
  labelNames: ['service', 'method', 'route', 'status_code'],
  registers: [register],
})

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
})

// Domain metrics: bookings
const bookingsOperationsTotal = new client.Counter({
  name: 'bookings_operations_total',
  help: 'Total booking operations by type and result',
  labelNames: ['service', 'operation', 'result'],
  registers: [register],
})

const bookingsStatusTransitionsTotal = new client.Counter({
  name: 'bookings_status_transitions_total',
  help: 'Booking status transitions by actor',
  labelNames: ['service', 'from', 'to', 'actor'],
  registers: [register],
})

const bookingDurationMinutes = new client.Histogram({
  name: 'booking_duration_minutes',
  help: 'Duration of bookings in minutes (endAt - startAt)',
  labelNames: ['service'],
  buckets: [5, 10, 15, 20, 30, 45, 60, 90, 120, 180],
  registers: [register],
})

const bookingsErrorsTotal = new client.Counter({
  name: 'bookings_errors_total',
  help: 'Domain errors in bookings operations',
  labelNames: ['service', 'operation', 'error_code'],
  registers: [register],
})

// Request instrumentation middleware
export function metricsMiddleware() {
  return async (c: Context, next: Next) => {
    if (c.req.path.startsWith('/metrics')) return next()
    const start = process.hrtime.bigint()
    let statusCode = 500
    let errorOccurred = false
    try {
      await next()
      statusCode = c.res.status
    } catch (err) {
      errorOccurred = true
      statusCode = 500
      throw err
    } finally {
      const duration = Number(process.hrtime.bigint() - start) / 1e9
      const labels = {
        service: SERVICE_NAME,
        method: c.req.method,
        route: c.req.path,
        status_code: String(statusCode),
      } as const
      httpRequestsTotal.labels(labels).inc()
      httpRequestDurationSeconds.labels(labels).observe(duration)
      if (errorOccurred || statusCode >= 500) {
        httpRequestErrorsTotal.labels(labels).inc()
      }
    }
  }
}

// Domain metric helpers
export type BookingOperation = 'create' | 'update' | 'delete' | 'get' | 'list'

export function recordBookingOperation(operation: BookingOperation, result: 'success' | 'error') {
  bookingsOperationsTotal.labels({ service: SERVICE_NAME, operation, result }).inc()
}

export function recordStatusTransition(from: string, to: string, actor: string) {
  bookingsStatusTransitionsTotal.labels({ service: SERVICE_NAME, from, to, actor }).inc()
}

export function observeBookingDuration(minutes: number) {
  if (Number.isFinite(minutes) && minutes >= 0) {
    bookingDurationMinutes.labels({ service: SERVICE_NAME }).observe(minutes)
  }
}

export function recordDomainError(operation: BookingOperation, errorCode: string) {
  bookingsErrorsTotal.labels({ service: SERVICE_NAME, operation, error_code: errorCode }).inc()
}

// Metrics endpoint helpers
export async function getMetrics(): Promise<string> {
  return await register.metrics()
}

export function getContentType(): string {
  return register.contentType
}