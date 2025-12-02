import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../app'
import { db } from '../../../db'
import {
  barberShops,
  barberHours,
  services as servicesTable,
  shopStaff,
  users,
  // bookings as bookingsTable,
  // bookingServices as bookingServicesTable,
} from '../../../db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'

// Helper: create a fully-open shop with services and staff
async function createShopWithData({ hours24 = true }: { hours24?: boolean }) {
  // Create shop
  const [shop] = await db.insert(barberShops).values({
    name: `Test Shop ${crypto.randomUUID().slice(0, 8)}`,
    address: 'Test Address',
    phone: '05551234567',
    gender: 'unisex',
    tenantId: 'kuaforun',
  }).returning()

  // Create hours (open 24h for all days)
  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    barberShopId: shop.id,
    weekday,
    openMinutes: hours24 ? 0 : 9 * 60,
    closeMinutes: hours24 ? 24 * 60 : 10 * 60,
    open24h: hours24,
  }))
  await db.insert(barberHours).values(hours)

  // Create two services
  const [svc1, svc2] = await db.insert(servicesTable).values([
    {
      barberShopId: shop.id,
      name: 'Kesim',
      price: '100.00',
      durationMinutes: 30,
    },
    {
      barberShopId: shop.id,
      name: 'Sakal',
      price: '150.00',
      durationMinutes: 45,
    },
  ]).returning()

  // Create users (barber & customer)
  const barberAuthId = crypto.randomUUID()
  const customerAuthId = crypto.randomUUID()
  const tenantId = 'kuaforun'
  const [barberUser] = await db.insert(users).values({
    id: barberAuthId,
    tenantId,
  }).returning()
  const [customerUser] = await db.insert(users).values({
    id: customerAuthId,
    tenantId,
  }).returning()

  // Create staff (barber)
  const [staff] = await db.insert(shopStaff).values({
    shopId: shop.id,
    userId: barberUser.id,
    role: 'barber',
    isActive: true,
    tenantId,
  }).returning()

  return { shop, services: [svc1, svc2], staff, barberUser, customerUser }
}

async function cleanupShop(shopId: string) {
  // Prefer cascading deletes by removing the shop; related rows should cascade.
  try {
    await db.delete(barberShops).where(eq(barberShops.id, shopId))
  } catch (err) {
    console.error('cleanupShop failed deleting barberShops:', err)
    throw err
  }
}

describe('Bookings API integration', () => {
  type BookingData = {
    endTime: string
    totalPrice: string | number
    services: Array<{ serviceId: string }>
  }
  type ApiResponse<T> = { success: boolean; data?: T; error?: { message?: string } }
  let shopId: string
  let serviceIds: string[]
  let staffId: string
  let customerId: string

  beforeAll(async () => {
    const data = await createShopWithData({ hours24: true })
    shopId = data.shop.id
    serviceIds = data.services.map(s => s.id)
    staffId = data.staff.id
    customerId = data.customerUser.id.toString()
  })

  afterAll(async () => {
    await cleanupShop(shopId)
    // Remove users
    await db.delete(users).where(eq(users.id, customerId))
    // staff user removal is cascaded via shopStaff? users table has no FK; delete manually
    // Find barber user by authUserId from staff
    // Not strictly necessary for test isolation since IDs are random
  })

  it('should create booking and compute endTime & totalPrice', async () => {
    const payload = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: '2030-01-01',
      startTime: '10:00',
      endTime: '00:00', // ignored by backend
      serviceIds,
      totalPrice: 250,
      notes: 'Integration test',
    }

    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as ApiResponse<BookingData>
    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
    expect(json.data!.endTime).toBe('11:15')
    expect(json.data!.totalPrice === '250.00' || json.data!.totalPrice === 250).toBe(true)
    expect(Array.isArray(json.data!.services)).toBe(true)
    expect(json.data!.services.length).toBe(2)
  })

  it('should reject booking when outside working hours', async () => {
    // Create a shop with restricted hours (09:00-10:00)
    const s2 = await createShopWithData({ hours24: false })
    const payload = {
      customerId: s2.customerUser.id,
      barberId: s2.staff.id,
      shopId: s2.shop.id,
      bookingDate: '2030-01-01',
      startTime: '10:30', // outside 09:00-10:00
      endTime: '00:00',
      serviceIds: s2.services.map(s => s.id),
      totalPrice: 250,
    }
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(422)
    const json = await res.json() as ApiResponse<unknown>
    expect(json.success).toBe(false)
    expect(String(json.error?.message || '').toLowerCase()).toContain('çalışma saatleri')
    await cleanupShop(s2.shop.id)
    await db.delete(users).where(eq(users.id, s2.customerUser.id))
    await db.delete(users).where(eq(users.id, s2.barberUser.id))
  })

  it('should prevent overlapping bookings for same barber', async () => {
    // First booking 10:00-11:15
    const firstPayload = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: '2030-01-02',
      startTime: '10:00',
      endTime: '00:00',
      serviceIds,
      totalPrice: 250,
    }
    const res1 = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firstPayload),
    })
    expect(res1.status).toBe(201)

    // Second booking overlapping 10:30-11:00
    const secondPayload = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: firstPayload.bookingDate,
      startTime: '10:30',
      endTime: '00:00',
      serviceIds: [serviceIds[0]], // 30 minutes
      totalPrice: 100,
    }
    const res2 = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secondPayload),
    })
    expect(res2.status).toBe(409)
    const json2 = await res2.json() as ApiResponse<unknown>
    expect(json2.success).toBe(false)
    expect(String(json2.error?.message || '').toLowerCase()).toContain('çakışan randevu')
  })

  it('should validate totalPrice mismatch', async () => {
    const payload = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: '2030-01-03',
      startTime: '09:00',
      endTime: '00:00',
      serviceIds,
      totalPrice: 999, // wrong
    }
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as ApiResponse<unknown>
    expect(json.success).toBe(false)
    expect(String(json.error?.message || '').toLowerCase()).toContain('toplam fiyat')
  })
})