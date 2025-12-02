import { Hono } from 'hono'
import type { Context } from 'hono'
import { db } from '../../db'
import { users, barberShops } from '../../db/schema'
import { getMetrics, getContentType } from '../../core/observability/metrics'

export const analyticsRouter = new Hono()

analyticsRouter.get('/summary', async (c: Context) => {
  const [userCount, shopCount] = await Promise.all([
    db.select().from(users).then((rows) => rows.length).catch(() => 0),
    db.select().from(barberShops).then((rows) => rows.length).catch(() => 0),
  ])
  return c.json({ data: { users: userCount, shops: shopCount } })
})

analyticsRouter.get('/metrics', async (c: Context) => {
  const metrics = await getMetrics()
  return c.newResponse(metrics, 200, { 'Content-Type': getContentType() })
})

