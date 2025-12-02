import { createMiddleware } from 'hono/factory'
import { getLogger } from '../logging/logger'
import crypto from 'node:crypto'

function truncate(text: string, max = 2000): string {
  if (text.length <= max) return text
  return text.slice(0, max) + ` ...(${text.length - max} more bytes)`
}

function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((v, k) => { obj[k.toLowerCase()] = v })
  // Mask sensitive
  if (obj['authorization']) obj['authorization'] = '[REDACTED]'
  if (obj['cookie']) obj['cookie'] = '[REDACTED]'
  return obj
}

function maskJson(jsonText: string): string {
  try {
    const data = JSON.parse(jsonText)
    const redact = (o: any) => {
      if (o && typeof o === 'object') {
        for (const k of Object.keys(o)) {
          const key = k.toLowerCase()
          if (['password', 'pass', 'token', 'refresh', 'authorization'].some(s => key.includes(s))) {
            o[k] = '[REDACTED]'
          } else {
            redact(o[k])
          }
        }
      }
    }
    redact(data)
    return JSON.stringify(data)
  } catch {
    return jsonText
  }
}

export const requestLogger = createMiddleware(async (c, next) => {
  const reqId = c.req.header('x-request-id') || crypto.randomUUID()
  const logger = getLogger('http', { requestId: reqId })
  c.set('requestId', reqId)
  c.set('logger', logger)

  const start = Date.now()

  // Request details
  const reqHeaders = headersToObject(c.req.raw.headers)
  let reqBodyPreview: string | undefined
  try {
    if (['POST','PUT','PATCH'].includes(c.req.method)) {
      const text = await c.req.raw.clone().text()
      const contentType = reqHeaders['content-type'] || ''
      const safe = contentType.includes('application/json') ? maskJson(text) : text
      reqBodyPreview = truncate(safe)
    }
  } catch {}

  logger.info({
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
    headers: reqHeaders,
    body: reqBodyPreview,
    ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || undefined,
  }, 'request start')

  try {
    await next()
  } finally {
    const durationMs = Date.now() - start
    // Response preview
    let resBodyPreview: string | undefined
    let resContentType: string | undefined
    try {
      const clone = c.res.clone()
      resContentType = clone.headers.get('content-type') || undefined
      const text = await clone.text()
      resBodyPreview = truncate(text)
    } catch {}
    logger.info({ status: c.res.status, durationMs, contentType: resContentType, body: resBodyPreview }, 'request end')
  }
})