import { Hono } from "hono"
import type { Context } from "hono"
import { db } from "../../db"
import { barberShops, barberHours } from "../../db/schema"
import { eq, and, sql } from "drizzle-orm"
import { resolveTenantId } from "../../shared/config/index"

export const publicShopsAliasRouter = new Hono()

publicShopsAliasRouter.get("/", async (c: Context) => {
  const gender = c.req.query("gender")
  const name = c.req.query("name")
  const city = c.req.query("city")
  const page = parseInt(c.req.query("page") || "1")
  const limit = parseInt(c.req.query("limit") || "10")
  const offset = Math.max(0, (page - 1) * limit)
  const tenantId = resolveTenantId(c.req.header())

  const conditions = [eq(barberShops.tenantId, tenantId)]
  if (gender && ["male", "female", "unisex"].includes(gender)) {
    conditions.push(eq(barberShops.gender, gender as "male" | "female" | "unisex"))
  }
  if (name) {
    conditions.push(sql`${barberShops.name} ILIKE ${"%" + name + "%"}`)
  }
  if (city) {
    conditions.push(
      sql`( ${barberShops.address} ILIKE ${"%" + city + "%"} OR ${barberShops.formattedAddress} ILIKE ${"%" + city + "%"} )`
    )
  }
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

  const list = await db
    .select()
    .from(barberShops)
    .where(whereClause)
    .orderBy(barberShops.createdAt)
    .limit(limit)
    .offset(offset)
  return c.json({ data: list, pagination: { page, limit, count: list.length } })
})

publicShopsAliasRouter.get("/:id", async (c: Context) => {
  const id = c.req.param("id")
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid shop ID" }, 400)
  }
  const rows = await db.select().from(barberShops).where(eq(barberShops.id, id))
  if (rows.length === 0) return c.json({ error: "Shop not found" }, 404)
  return c.json({ data: rows[0] })
})

publicShopsAliasRouter.get("/:id/hours", async (c: Context) => {
  const id = c.req.param("id")
  const dayParam = c.req.query("day")
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid shop ID format" }, 400)
  }
  const day = dayParam !== undefined ? Number(dayParam) : undefined
  const minutesToHHmm = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  const whereClause =
    day !== undefined && Number.isFinite(day)
      ? and(eq(barberHours.barberShopId, id), eq(barberHours.weekday, day))
      : eq(barberHours.barberShopId, id)
  const hours = await db.select().from(barberHours).where(whereClause)
  const normalized = hours.map((h) => ({
    id: h.id,
    weekday: h.weekday,
    openMinutes: h.openMinutes,
    closeMinutes: h.closeMinutes,
    open24h: Boolean(h.open24h),
    open: h.open24h ? "00:00" : minutesToHHmm(h.openMinutes ?? 0),
    close: h.open24h ? "23:59" : minutesToHHmm(h.closeMinutes ?? 0),
  }))
  if (day !== undefined && normalized.length === 0) {
    const openDefault = 9 * 60
    const closeDefault = 18 * 60
    return c.json({
      data: [
        {
          weekday: day,
          openMinutes: openDefault,
          closeMinutes: closeDefault,
          open24h: false,
          open: minutesToHHmm(openDefault),
          close: minutesToHHmm(closeDefault),
        },
      ],
    })
  }
  return c.json({ data: normalized })
})
