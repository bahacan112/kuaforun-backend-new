import { Hono } from 'hono'
import type { Context } from 'hono'
import { db } from '../../db'
import { users, barberShops } from '../../db/schema'
import { eq } from 'drizzle-orm'

export const tenantsRouter = new Hono()

tenantsRouter.get('/', async (c: Context) => {
  const ids = new Set<string>()
  try {
    const userRows = await db.select({ tenantId: users.tenantId }).from(users)
    for (const r of userRows) if (r.tenantId) ids.add(String(r.tenantId))
  } catch {}
  try {
    const shopRows = await db.select({ tenantId: barberShops.tenantId }).from(barberShops)
    for (const r of shopRows) if (r.tenantId) ids.add(String(r.tenantId))
  } catch {}
  return c.json({ data: Array.from(ids) })
})

tenantsRouter.get('/:tenantId/summary', async (c: Context) => {
  const tenantId = c.req.param('tenantId')
  if (!tenantId) return c.json({ error: 'tenantId required' }, 400)
  const [userCount, shopCount] = await Promise.all([
    db.select().from(users).where(eq(users.tenantId, tenantId)).then((rows) => rows.length).catch(() => 0),
    db.select().from(barberShops).where(eq(barberShops.tenantId, tenantId)).then((rows) => rows.length).catch(() => 0),
  ])
  return c.json({ data: { tenantId, users: userCount, shops: shopCount } })
})

