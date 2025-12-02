import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import app from '../../../app'
import { db } from '../../../db'
import {
  barberShops,
  barberHours,
  services as servicesTable,
  shopStaff,
  users,
  systemSettings,
} from '../../../db/schema'
import { and, eq } from 'drizzle-orm'
import crypto from 'node:crypto'

type ApiResponse<T> = { success: boolean; data?: T; error?: { message?: string } }
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type BookingServiceItem = { serviceId: string; serviceName?: string; servicePrice?: string | number; serviceDuration?: number }
type BookingData = { id: string; status?: BookingStatus; endTime?: string; totalPrice?: string | number; services?: BookingServiceItem[] }

// Helper: create a fully-open shop with services and staff
async function createShopWithData({ hours24 = true }: { hours24?: boolean }) {
  const [shop] = await db.insert(barberShops).values({
    name: `RBAC Shop ${crypto.randomUUID().slice(0, 8)}`,
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
    { barberShopId: shop.id, name: 'Kesim', price: '100.00', durationMinutes: 30 },
    { barberShopId: shop.id, name: 'Sakal', price: '150.00', durationMinutes: 45 },
  ]).returning()

  // Create users (barber & customer)
  const barberAuthId = crypto.randomUUID()
  const customerAuthId = crypto.randomUUID()
  const tenantId = 'kuaforun'
  const [barberUser] = await db.insert(users).values({ id: barberAuthId, tenantId }).returning()
  const [customerUser] = await db.insert(users).values({ id: customerAuthId, tenantId }).returning()

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
  await db.delete(barberShops).where(eq(barberShops.id, shopId))
}

function fmtDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtTimeFromMinutes(min: number) {
  const hh = Math.floor(min / 60)
  const mm = min % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

async function createBookingAndGetId(payload: Record<string, unknown>): Promise<BookingData> {
  const res = await app.request('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  expect(res.status).toBe(201)
  const json = await res.json() as ApiResponse<BookingData>
  expect(json.success).toBe(true)
  expect(json.data?.id).toBeDefined()
  return json.data as BookingData
}

async function upsertSetting(key: string, value: unknown, tenantId = 'kuaforun') {
  const rows = await db.select().from(systemSettings).where(and(eq(systemSettings.tenantId, tenantId), eq(systemSettings.key, key))).limit(1)
  if (rows.length > 0) {
    await db.update(systemSettings).set({ value }).where(and(eq(systemSettings.tenantId, tenantId), eq(systemSettings.key, key)))
  } else {
    await db.insert(systemSettings).values({ key, value, tenantId })
  }
}

// Stub auth validation used by authMiddleware: return success for any token
beforeAll(() => {
  const original: typeof fetch | undefined = globalThis.fetch as typeof fetch | undefined
  // Use fetch parameter types to avoid relying on DOM lib types like RequestInfo in Node
  const mockFetch: typeof fetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (String(url).includes('/auth/validate')) {
      const body = {
        success: true,
        data: {
          id: 'mock-auth-user-id',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'customer',
          tenantId: 'kuaforun',
          isEmailVerified: true,
          isPhoneVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (original) return original(input, init)
    return Promise.reject(new Error('fetch not available'))
  }
  vi.stubGlobal('fetch', mockFetch)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('Bookings API RBAC & Status Transitions', () => {
  let shopId: string
  let serviceIds: string[]
  let staffId: string
  let customerId: string
  let staffAuthUserId: string

  beforeAll(async () => {
    const data = await createShopWithData({ hours24: true })
    shopId = data.shop.id
    serviceIds = data.services.map(s => s.id)
    staffId = data.staff.id
    staffAuthUserId = data.barberUser.id
    customerId = data.customerUser.id.toString()
  })

  afterAll(async () => {
    await cleanupShop(shopId)
    await db.delete(users).where(eq(users.id, customerId))
    // Barber user kaydı authUserId ile silinmeli
    await db.delete(users).where(eq(users.id, staffAuthUserId))
  })

  beforeEach(async () => {
    // Ensure minimal lead time does not block tests that use near-future bookings
    await upsertSetting('booking_min_lead_minutes', { value: 0 })
    // Default grace to 15 unless overridden in specific tests
    await upsertSetting('booking_status_grace_minutes', { value: 15 })
  })

  it('Customer: pending -> cancelled allowed; pending -> confirmed forbidden', async () => {
    const payload = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: '2030-02-01',
      startTime: '10:00',
      endTime: '00:00',
      serviceIds,
      totalPrice: 250,
      notes: 'RBAC test',
    }
    const created = await createBookingAndGetId(payload)

    // Cancel as customer
    const resCancel = await app.request(`/bookings/${created.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': customerId,
        'X-User-Role': 'customer',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    expect(resCancel.status).toBe(200)
    const jsonCancel = await resCancel.json() as ApiResponse<BookingData>
    expect(jsonCancel.success).toBe(true)
    expect(jsonCancel.data?.status).toBe('cancelled')

    // Try to confirm as customer -> forbidden
    const created2 = await createBookingAndGetId(payload)
    const resConfirm = await app.request(`/bookings/${created2.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': customerId,
        'X-User-Role': 'customer',
      },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(resConfirm.status).toBe(403)
    const jsonConfirm = await resConfirm.json() as ApiResponse<unknown>
    expect(jsonConfirm.success).toBe(false)
  })

  it('Staff: pending -> confirmed and pending -> no_show allowed', async () => {
    // pending -> confirmed
    const payloadA = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: '2030-02-02',
      startTime: '10:00',
      endTime: '00:00',
      serviceIds,
      totalPrice: 250,
    }
    const createdA = await createBookingAndGetId(payloadA)
    const resConfirmed = await app.request(`/bookings/${createdA.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': staffAuthUserId,
        'X-User-Role': 'staff',
      },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(resConfirmed.status).toBe(200)
    const jsonConfirmed = await resConfirmed.json() as ApiResponse<BookingData>
    expect(jsonConfirmed.data?.status).toBe('confirmed')

    // pending -> no_show (start in the past beyond grace)
    const now = new Date()
    const dateStr = fmtDate(now)
    // UTC dakika üzerinden hesapla; service layer 'bookingDayStart' için UTC midnight kullanıyor
    const utcNowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
    const startMinPast = Math.max(0, utcNowMin - 30) // 30 dk geçmiş
    const payloadB = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: dateStr,
      startTime: fmtTimeFromMinutes(startMinPast),
      endTime: '00:00',
      serviceIds: [serviceIds[0]], // 30 minutes
      totalPrice: 100,
    }
    const createdB = await createBookingAndGetId(payloadB)
    const resNoShow = await app.request(`/bookings/${createdB.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': staffAuthUserId,
        'X-User-Role': 'staff',
      },
      body: JSON.stringify({ status: 'no_show' }),
    })
    expect(resNoShow.status).toBe(200)
    const jsonNoShow = await resNoShow.json() as ApiResponse<BookingData>
    expect(jsonNoShow.data?.status).toBe('no_show')
  })

  it('Staff: confirmed -> completed, cancelled, no_show allowed (with time rules)', async () => {
    // Ayrı bir mağaza/staff oluşturup zaman çakışmalarını izole edelim
    const local = await createShopWithData({ hours24: true })
    const localShopId = local.shop.id
    const localServiceIds = local.services.map(s => s.id)
    const localStaffId = local.staff.id
    const localStaffAuthUserId = local.barberUser.id
    const localCustomerId = local.customerUser.id

    {
      // Create a booking that ended in the past, confirm then complete
      const now = new Date()
      const dateStr = fmtDate(now)
      // Start 100 minutes ago so end (75 min duration) is 25 minutes ago
      const startMinPast = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - 100)
      const payloadPast = {
        customerId: localCustomerId,
        barberId: localStaffId,
        shopId: localShopId,
        bookingDate: dateStr,
        startTime: fmtTimeFromMinutes(startMinPast),
        endTime: '00:00',
        serviceIds: localServiceIds,
        totalPrice: 250,
      }
      const createdPast = await createBookingAndGetId(payloadPast)
      const resConfirmPast = await app.request(`/bookings/${createdPast.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Id': localStaffAuthUserId || undefined,
          'X-User-Role': 'staff',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      expect(resConfirmPast.status).toBe(200)
      const resCompletePast = await app.request(`/bookings/${createdPast.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Id': localStaffAuthUserId || undefined,
          'X-User-Role': 'staff',
        },
        body: JSON.stringify({ status: 'completed' }),
      })
      expect(resCompletePast.status).toBe(200)
      const jsonCompletePast = await resCompletePast.json() as ApiResponse<BookingData>
      expect(jsonCompletePast.data?.status).toBe('completed')
    }

    {
      // Create a booking, confirm then cancel
      const payloadC = {
        customerId: localCustomerId,
        barberId: localStaffId,
        shopId: localShopId,
        bookingDate: '2030-02-03',
        startTime: '09:00',
        endTime: '00:00',
        serviceIds: localServiceIds,
        totalPrice: 250,
      }
      const createdC = await createBookingAndGetId(payloadC)
      const resConfirmC = await app.request(`/bookings/${createdC.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Id': localStaffAuthUserId || undefined,
          'X-User-Role': 'staff',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      expect(resConfirmC.status).toBe(200)
      const resCancelC = await app.request(`/bookings/${createdC.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Id': localStaffAuthUserId || undefined,
          'X-User-Role': 'staff',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      expect(resCancelC.status).toBe(200)
      const jsonCancelC = await resCancelC.json() as ApiResponse<BookingData>
      expect(jsonCancelC.data?.status).toBe('cancelled')
    }

    {
      // confirmed -> no_show (time rule: after grace)
      const now = new Date()
      const dateStr = fmtDate(now)
      const utcNowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
      const startMinPast2 = Math.max(0, utcNowMin - 40) // 40 dk önce (> grace)
      const payloadD = {
        customerId: localCustomerId,
        barberId: localStaffId,
        shopId: localShopId,
        bookingDate: dateStr,
        startTime: fmtTimeFromMinutes(startMinPast2),
        endTime: '00:00',
        serviceIds: [localServiceIds[0]], // 30 minutes
        totalPrice: 100,
      }
      const createdD = await createBookingAndGetId(payloadD)
      const resConfirmD = await app.request(`/bookings/${createdD.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Id': localStaffAuthUserId || undefined,
          'X-User-Role': 'staff',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      expect(resConfirmD.status).toBe(200)
      const resNoShowD = await app.request(`/bookings/${createdD.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Id': localStaffAuthUserId || undefined,
          'X-User-Role': 'staff',
        },
        body: JSON.stringify({ status: 'no_show' }),
      })
      expect(resNoShowD.status).toBe(200)
      const jsonNoShowD = await resNoShowD.json() as ApiResponse<BookingData>
      expect(jsonNoShowD.data?.status).toBe('no_show')
    }

    // Temizlik: lokal shop'u kaldır
    await cleanupShop(localShopId)
  })

  it('Admin: can change terminal statuses (e.g., cancelled -> confirmed)', async () => {
    const payload = {
      customerId,
      barberId: staffId,
      shopId,
      bookingDate: '2030-02-04',
      startTime: '10:00',
      endTime: '00:00',
      serviceIds,
      totalPrice: 250,
    }
    const created = await createBookingAndGetId(payload)
    // First cancel as staff
    const resCancel = await app.request(`/bookings/${created.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': staffAuthUserId,
        'X-User-Role': 'staff',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    expect(resCancel.status).toBe(200)

    // Now admin changes cancelled -> confirmed
    const resAdmin = await app.request(`/bookings/${created.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': crypto.randomUUID(),
        'X-User-Role': 'admin',
      },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(resAdmin.status).toBe(200)
    const jsonAdmin = await resAdmin.json() as ApiResponse<BookingData>
    expect(jsonAdmin.data?.status).toBe('confirmed')
  })

  it('Time rules: no_show before grace is blocked; completed before end time is blocked', async () => {
    // Ayrı bir mağaza/staff oluşturup zaman çakışmalarını izole edelim
    const local = await createShopWithData({ hours24: true })
    const localShopId = local.shop.id
    const localServiceIds = local.services.map(s => s.id)
    const localStaffId = local.staff.id
    const localStaffAuthUserId = local.barberUser.id
    const localCustomerId = local.customerUser.id

    const now = new Date()
    const dateStr = fmtDate(now)
    // Start 5 minutes ago (< grace 15)
    const startMinPastSmall = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - 5)
    const payloadNoShow = {
      customerId: localCustomerId,
      barberId: localStaffId,
      shopId: localShopId,
      bookingDate: dateStr,
      startTime: fmtTimeFromMinutes(startMinPastSmall),
      endTime: '00:00',
      serviceIds: [localServiceIds[0]], // 30 minutes
      totalPrice: 100,
    }
    const createdNoShow = await createBookingAndGetId(payloadNoShow)
    const resNoShowBlocked = await app.request(`/bookings/${createdNoShow.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': localStaffAuthUserId || undefined,
        'X-User-Role': 'staff',
      },
      body: JSON.stringify({ status: 'no_show' }),
    })
    expect(resNoShowBlocked.status).toBe(422)

    // Completed before end time blocked: start now, duration 75 -> end in future
    const startMinNow = now.getHours() * 60 + now.getMinutes()
    const startMinFuture = (startMinNow + 60) % (24 * 60)
    const payloadCompleted = {
      customerId: localCustomerId,
      barberId: localStaffId,
      shopId: localShopId,
      bookingDate: dateStr,
      startTime: fmtTimeFromMinutes(startMinFuture),
      endTime: '00:00',
      serviceIds: localServiceIds,
      totalPrice: 250,
    }
    const createdCompleted = await createBookingAndGetId(payloadCompleted)
    // First confirm
    const resConfirm = await app.request(`/bookings/${createdCompleted.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': localStaffAuthUserId || undefined,
        'X-User-Role': 'staff',
      },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(resConfirm.status).toBe(200)
    // Then try to complete (should be blocked since end time is in the future)
    const resCompleteBlocked = await app.request(`/bookings/${createdCompleted.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-User-Id': localStaffAuthUserId || undefined,
        'X-User-Role': 'staff',
      },
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(resCompleteBlocked.status).toBe(422)

    // Temizlik
    await cleanupShop(localShopId)
    await db.delete(users).where(eq(users.id, localCustomerId))
    if (localStaffAuthUserId) {
      await db.delete(users).where(eq(users.id, localStaffAuthUserId))
    }
  })
})