import { db } from '../../db'
import { barberShops, barberPhotos } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { AppError } from '../../core/errors'
import type { ImportSerpApiInput, UploadGooglePhotoInput } from './shops.dto'
import type { IPlacesSearch } from '../../core/contracts/search'
import type { IStorageUploader } from '../../core/contracts/storage'
import { env } from '../../core/env'
import { ServicesService } from '../services/services.service'

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371e3
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export type ImportResult = {
  inserted: number
  skipped: number
  updated: number
  insertedIds: string[]
  updatedIds: string[]
}

export class ShopService {
  private servicesService: ServicesService

  constructor(private places: IPlacesSearch, private storage: IStorageUploader) {
    this.servicesService = new ServicesService()
  }

  async importSerpApi(input: ImportSerpApiInput): Promise<ImportResult> {
    const { lat, lng, query, lang, zoom, radius, limit } = input
    const candidates = await this.places.search({ lat, lng, query, lang, zoom })

    // Query'ye göre gender belirleme
    const determineGender = (searchQuery: string): 'male' | 'female' | 'unisex' => {
      const lowerQuery = searchQuery.toLowerCase()
      if (lowerQuery.includes('erkek') || lowerQuery.includes('men') || lowerQuery.includes('male')) {
        return 'male'
      }
      if (lowerQuery.includes('kadın') || lowerQuery.includes('bayan') || lowerQuery.includes('women') || lowerQuery.includes('female')) {
        return 'female'
      }
      return 'unisex'
    }

    const shopGender = determineGender(query)

    const rows = candidates
      .filter((c) => toNumberOrUndefined(c.latitude) && toNumberOrUndefined(c.longitude))
      .map((c) => ({
        ...c,
        distance: distanceMeters(lat, lng, c.latitude!, c.longitude!),
      }))
      .filter((c) => c.distance <= radius)
      .slice(0, limit)

    const insertedIds: string[] = []
    const updatedIds: string[] = []
    let skipped = 0
    let updated = 0

    for (const item of rows) {
      if (!item.name) {
        skipped++
        continue
      }
      const existing = await db
        .select()
        .from(barberShops)
        .where(eq(barberShops.googlePlaceId, item.googlePlaceId ?? ''))
        .limit(1)

      if (existing.length > 0) {
        // Mevcut kayıt var - gender kontrolü yap
        const existingShop = existing[0]
        
        // Eğer mevcut gender 'unisex' ve yeni gender farklıysa güncelle
        if (existingShop.gender === 'unisex' && shopGender !== 'unisex') {
          const updatePayload = {
            gender: shopGender,
            updatedAt: new Date(),
          }
          
          await db
            .update(barberShops)
            .set(updatePayload)
            .where(eq(barberShops.id, existingShop.id))
          
          updatedIds.push(existingShop.id)
          updated++
        } else {
          // Değişiklik yok, skip et
          skipped++
        }
        continue
      }

      const payload: typeof barberShops.$inferInsert = {
        name: item.name,
        address: item.address ?? 'Unknown address',
        phone: item.phone ?? 'N/A',
        tenantId: input.tenantId ?? 'kuaforun',
        gender: shopGender, // Query'ye göre belirlenen gender
        latitude: typeof item.latitude === 'number' ? String(item.latitude) : undefined,
        longitude: typeof item.longitude === 'number' ? String(item.longitude) : undefined,
        googleRating: typeof item.googleRating === 'number' ? String(item.googleRating) : undefined,
        googlePlaceId: item.googlePlaceId ?? undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const inserted = await db.insert(barberShops).values(payload).returning({ id: barberShops.id })
      if (inserted.length > 0) {
        const newShopId = inserted[0].id
        insertedIds.push(newShopId)
        
        // Yeni kuaför eklendiğinde otomatik hizmetleri ekle
        try {
          await this.servicesService.addDefaultServicesToShop(newShopId)
        } catch (error) {
          console.warn(`Failed to add default services to shop ${newShopId}:`, error)
          // Hizmet ekleme hatası kuaför eklemeyi engellemez, sadece log'larız
        }
      }
    }

    return { inserted: insertedIds.length, skipped, updated, insertedIds, updatedIds }
  }

  async uploadGooglePhoto(shopId: string, input: UploadGooglePhotoInput) {
    if (!env.GOOGLE_MAPS_API_KEY) {
      throw new AppError('GOOGLE_MAPS_API_KEY is not configured', 500, 'ENV_MISSING')
    }
    const { photoReference, width } = input
    const url = new URL('https://maps.googleapis.com/maps/api/place/photo')
    url.searchParams.set('maxwidth', String(width))
    url.searchParams.set('photo_reference', photoReference)
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY)

    const res = await fetch(url)
    if (!res.ok) {
      throw new AppError('Google photo download failed', res.status as 400 | 500, 'GOOGLE_PHOTO_ERROR')
    }
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const key = `shops/${shopId}/google/${photoReference}.jpg`
    const uploaded = await this.storage.upload({ key, body: buffer, contentType: 'image/jpeg' })

    const existing = await db
      .select()
      .from(barberPhotos)
      .where(eq(barberPhotos.storageKey, uploaded.key))
      .limit(1)

    if (existing.length > 0) {
      return { duplicated: true, photo: existing[0] }
    }

    const photoPayload: typeof barberPhotos.$inferInsert = {
      barberShopId: shopId,
      photoReference: input.photoReference,
      width: input.width ?? undefined,
      storageKey: uploaded.key,
      storageUrl: uploaded.url ?? undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const inserted = await db.insert(barberPhotos).values(photoPayload).returning()
    return { duplicated: false, photo: inserted[0] }
  }
}