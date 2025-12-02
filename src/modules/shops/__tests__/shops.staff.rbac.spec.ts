import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import app from '../../../app'
import { db } from '../../../db'
import {
  barberShops,
  barberHours,
  shopStaff,
  userFavoriteBarbers,
  users,
  type NewShopStaff,
} from '../../../db/schema'
import { and, eq } from 'drizzle-orm'
import crypto from 'node:crypto'

// Use a valid UUID for the mocked auth user to satisfy uuid-typed DB columns
const AUTH_USER_ID = crypto.randomUUID()

type StaffModel = { id: string; shopId: string; userId: string; role: NewShopStaff['role']; isActive: boolean }
type StaffWithFav = StaffModel & { isFavorite?: boolean }

// Helper: create shop with 24h hours for simplicity
async function createShop(hours24 = true) {
  const [shop] = await db.insert(barberShops).values({
    name: `Staff RBAC Shop ${crypto.randomUUID().slice(0, 8)}`,
    address: 'Test Address',
    phone: '05551234567',
    gender: 'unisex',
    tenantId: 'kuaforun',
  }).returning()

  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    barberShopId: shop.id,
    weekday,
    openMinutes: hours24 ? 0 : 9 * 60,
    closeMinutes: hours24 ? 24 * 60 : 18 * 60,
    open24h: hours24,
  }))
  await db.insert(barberHours).values(hours)
  return shop
}

// Ensure a user exists with given authUserId (tenant defaults to 'kuaforun')
async function ensureUser(authUserId: string, tenantId = 'kuaforun') {
  const existing = await db.select().from(users).where(and(eq(users.id, authUserId), eq(users.tenantId, tenantId))).limit(1)
  if (existing.length > 0) return existing[0]
  const [created] = await db.insert(users).values({ id: authUserId, tenantId }).returning()
  return created
}

// Create a staff row for a shop mapped to a given auth user id and role
async function createStaff(shopId: string, authUserId: string, role: NewShopStaff['role'] = 'barber', tenantId = 'kuaforun') {
  await ensureUser(authUserId, tenantId)
  const [created] = await db.insert(shopStaff).values({ shopId, userId: authUserId, role, isActive: true, tenantId }).returning()
  return created
}

// Stub auth validation used by authMiddleware
beforeAll(() => {
  const original: typeof fetch | undefined = globalThis.fetch as typeof fetch | undefined
  const mockFetch: typeof fetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (String(url).includes('/auth/validate')) {
      const body = {
        success: true,
        data: {
          id: AUTH_USER_ID,
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

describe('Shops Staff API RBAC & Favorites', () => {
  let shopId: string
  const ownerAuthUserId = AUTH_USER_ID
  let barberA: StaffModel
  let barberB: StaffModel

  beforeAll(async () => {
    const shop = await createShop(true)
    shopId = shop.id
    // Owner for RBAC
    await createStaff(shopId, ownerAuthUserId, 'owner')
    // Two barbers
    barberA = await createStaff(shopId, crypto.randomUUID(), 'barber')
    barberB = await createStaff(shopId, crypto.randomUUID(), 'barber')
    // Favorite barberB for owner user
    await db.insert(userFavoriteBarbers).values({ userId: ownerAuthUserId, staffId: barberB.id, tenantId: 'kuaforun' })
  })

  afterAll(async () => {
    // Cleanup shop cascade will remove staff/hours/leaves/favorites
    await db.delete(barberShops).where(eq(barberShops.id, shopId))
    // Remove owner user record created by ensureUser
    await db.delete(users).where(eq(users.id, ownerAuthUserId))
  })

  beforeEach(async () => {
    // no-op for now
  })

  it('GET /shops/:id/staff: returns list; favorites come first when X-User-Id header provided', async () => {
    const res = await app.request(`/shops/${shopId}/staff`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': ownerAuthUserId, // actor header used for favorites sorting
      },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: StaffWithFav[] }
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(2)
    // First item should be favorite barberB
    const first = json.data[0]
    expect(first.id).toBe(barberB.id)
    expect(first.isFavorite).toBe(true)

    // Without actor header, favorites should not be marked
    const resNoActor = await app.request(`/shops/${shopId}/staff`)
    expect(resNoActor.status).toBe(200)
    const jsonNoActor = await resNoActor.json() as { data: StaffWithFav[] }
    const favInNoActor = jsonNoActor.data.find((s) => s.id === barberB.id)
    expect(favInNoActor?.isFavorite).toBeFalsy()
  })

  it('POST /shops/:id/staff: only owner/manager can create staff', async () => {
    // Create a new user to add as staff
    const newStaffAuthId = crypto.randomUUID()
    await ensureUser(newStaffAuthId)
    const res = await app.request(`/shops/${shopId}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ userId: newStaffAuthId, role: 'barber' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as { data: StaffModel }
    expect(json.data?.shopId).toBe(shopId)
    expect(json.data?.userId).toBe(newStaffAuthId)
    expect(json.data?.role).toBe('barber')

    // Without Authorization -> 401
    const resNoAuth = await app.request(`/shops/${shopId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: crypto.randomUUID(), role: 'barber' }),
    })
    expect(resNoAuth.status).toBe(401)
  })

  it('POST/PATCH/DELETE /shops/:id/staff require admin; non-admin (barber) is forbidden (403)', async () => {
    // Create separate shop where current auth user is only a barber
    const otherShop = await createShop(true)
    const otherShopId = otherShop.id
    await createStaff(otherShopId, ownerAuthUserId, 'barber') // not owner/manager

    const targetAuthId = crypto.randomUUID()
    await ensureUser(targetAuthId)

    // Try create -> 403
    const resCreate = await app.request(`/shops/${otherShopId}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ userId: targetAuthId, role: 'assistant' }),
    })
    expect(resCreate.status).toBe(403)

    // Create staff as direct DB to test patch/delete
    const targetStaff = await createStaff(otherShopId, targetAuthId, 'assistant')

    // Try patch -> 403
    const resPatch = await app.request(`/shops/${otherShopId}/staff/${targetStaff.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ role: 'reception' }),
    })
    expect(resPatch.status).toBe(403)

    // Try delete -> 403
    const resDel = await app.request(`/shops/${otherShopId}/staff/${targetStaff.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer test-token',
      },
    })
    expect(resDel.status).toBe(403)

    // Cleanup other shop
    await db.delete(barberShops).where(eq(barberShops.id, otherShopId))
    await db.delete(users).where(eq(users.id, targetAuthId))
  })

  it('Staff hours: GET public; POST/PATCH/DELETE require admin', async () => {
    // Create hours for barberA using admin
    const resPost = await app.request(`/shops/${shopId}/staff/${barberA.id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ weekday: 1, openTime: '09:00', closeTime: '17:00' }),
    })
    expect(resPost.status).toBe(201)
    const jsonPost = await resPost.json() as { data: { id: string } }
    const hourId = jsonPost.data.id

    // GET without auth
    const resGet = await app.request(`/shops/${shopId}/staff/${barberA.id}/hours`)
    expect(resGet.status).toBe(200)
    const jsonGet = await resGet.json() as { data: Array<{ id: string; weekday: number }> }
    expect(jsonGet.data.some(h => h.id === hourId)).toBe(true)

    // PATCH with admin
    const resPatch = await app.request(`/shops/${shopId}/staff/${barberA.id}/hours/${hourId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ isActive: false }),
    })
    expect(resPatch.status).toBe(200)

    // DELETE with admin
    const resDel = await app.request(`/shops/${shopId}/staff/${barberA.id}/hours/${hourId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer test-token' },
    })
    expect(resDel.status).toBe(200)

    // Non-admin scenario: separate shop where current auth user is barber only
    const otherShop = await createShop(true)
    const otherShopId = otherShop.id
    const otherBarberAuthId = crypto.randomUUID()
    await createStaff(otherShopId, ownerAuthUserId, 'barber')
    const otherBarber = await createStaff(otherShopId, otherBarberAuthId, 'barber')

    // Try creating hours -> 403
    const resForbidden = await app.request(`/shops/${otherShopId}/staff/${otherBarber.id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ weekday: 2, openTime: '10:00', closeTime: '18:00' }),
    })
    expect(resForbidden.status).toBe(403)

    await db.delete(barberShops).where(eq(barberShops.id, otherShopId))
    await db.delete(users).where(eq(users.id, otherBarberAuthId))
  })

  it('Staff leaves: GET public; POST/PATCH/DELETE require admin', async () => {
    // Create leave for barberB using admin
    const resPost = await app.request(`/shops/${shopId}/staff/${barberB.id}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ startDate: '2030-01-01', endDate: '2030-01-01', fullDay: true, reason: 'Annual leave' }),
    })
    expect(resPost.status).toBe(201)
    const jsonPost = await resPost.json() as { data: { id: string } }
    const leaveId = jsonPost.data.id

    // GET without auth
    const resGet = await app.request(`/shops/${shopId}/staff/${barberB.id}/leaves`)
    expect(resGet.status).toBe(200)
    const jsonGet = await resGet.json() as { data: Array<{ id: string; startDate: string }> }
    expect(jsonGet.data.some(l => l.id === leaveId)).toBe(true)

    // PATCH with admin
    const resPatch = await app.request(`/shops/${shopId}/staff/${barberB.id}/leaves/${leaveId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ reason: 'Updated' }),
    })
    expect(resPatch.status).toBe(200)

    // DELETE with admin
    const resDel = await app.request(`/shops/${shopId}/staff/${barberB.id}/leaves/${leaveId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer test-token' },
    })
    expect(resDel.status).toBe(200)

    // Non-admin scenario: separate shop where current auth user is barber only
    const otherShop = await createShop(true)
    const otherShopId = otherShop.id
    const otherBarberAuthId = crypto.randomUUID()
    await createStaff(otherShopId, ownerAuthUserId, 'barber')
    const otherBarber = await createStaff(otherShopId, otherBarberAuthId, 'barber')

    // Try creating leaves -> 403
    const resForbidden = await app.request(`/shops/${otherShopId}/staff/${otherBarber.id}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ startDate: '2030-02-01', endDate: '2030-02-01', fullDay: true }),
    })
    expect(resForbidden.status).toBe(403)

    await db.delete(barberShops).where(eq(barberShops.id, otherShopId))
    await db.delete(users).where(eq(users.id, otherBarberAuthId))
  })
})