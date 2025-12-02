import { db } from '../../db'
import { serviceTemplates, services, barberShops } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { AppError } from '../../core/errors'
import { MALE_SERVICES, FEMALE_SERVICES, ALL_SERVICE_TEMPLATES } from './service-templates'

export type ShopGender = 'male' | 'female' | 'unisex'

export class ServicesService {
  
  /**
   * Veritabanına standart hizmet şablonlarını ekler
   */
  async seedServiceTemplates(): Promise<{ inserted: number, skipped: number }> {
    let inserted = 0
    let skipped = 0

    for (const template of ALL_SERVICE_TEMPLATES) {
      // Aynı isim ve gender kombinasyonu var mı kontrol et
      const existing = await db
        .select()
        .from(serviceTemplates)
        .where(
          and(
            eq(serviceTemplates.name, template.name),
            eq(serviceTemplates.gender, template.gender)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        skipped++
        continue
      }

      await db.insert(serviceTemplates).values({
        name: template.name,
        gender: template.gender,
        defaultPrice: template.defaultPrice.toString(), // Convert number to string for numeric field
        defaultDurationMinutes: template.defaultDurationMinutes,
        description: template.description,
        category: template.category,
        isActive: true,
      })

      inserted++
    }

    return { inserted, skipped }
  }

  /**
   * Kuaför kayıt olduğunda otomatik hizmetleri ekler
   */
  async addDefaultServicesToShop(shopId: string): Promise<{ added: number, shopGender: ShopGender }> {
    // Önce shop'ın gender'ını al
    const shop = await db
      .select({ gender: barberShops.gender })
      .from(barberShops)
      .where(eq(barberShops.id, shopId))
      .limit(1)

    if (shop.length === 0) {
      throw new AppError('Shop not found', 404, 'SHOP_NOT_FOUND')
    }

    const shopGender = shop[0].gender as ShopGender

    // Aktif hizmet şablonlarını veritabanından getir (super-admin panelinde yönetilen)
    const templatesToUse = await this.getActiveServiceTemplates(
      shopGender === 'unisex' ? undefined : shopGender
    )

    let added = 0

    for (const template of templatesToUse) {
      // Bu shop'ta bu hizmet zaten var mı kontrol et
      const existingService = await db
        .select()
        .from(services)
        .where(
          and(
            eq(services.barberShopId, shopId),
            eq(services.name, template.name)
          )
        )
        .limit(1)

      if (existingService.length > 0) {
        continue // Zaten var, skip et
      }

      await db.insert(services).values({
        barberShopId: shopId,
        serviceTemplateId: template.id ?? null,
        name: template.name,
        price: String(template.defaultPrice),
        durationMinutes: template.defaultDurationMinutes,
        description: template.description ?? null,
        category: template.category ?? null,
        isActive: true,
      })

      added++
    }

    return { added, shopGender }
  }

  /**
   * Belirli bir shop'ın hizmetlerini listeler
   */
  async getShopServices(shopId: string) {
    return await db
      .select()
      .from(services)
      .where(eq(services.barberShopId, shopId))
  }

  /**
   * Aktif hizmet şablonlarını listeler
   */
  async getActiveServiceTemplates(gender?: ShopGender) {
    if (gender && gender !== 'unisex') {
      return await db.select().from(serviceTemplates).where(
        and(
          eq(serviceTemplates.isActive, true),
          eq(serviceTemplates.gender, gender)
        )
      )
    }
    
    return await db.select().from(serviceTemplates).where(eq(serviceTemplates.isActive, true))
  }
}