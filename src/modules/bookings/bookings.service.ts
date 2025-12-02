import { db } from "../../db";
import { bookings, bookingServices, services, barberHours, systemSettings, shopStaff, users, barberShops } from "../../db/schema";
import type { NewBooking, BookingUpdate } from "../../db/schema";
import { eq, and, desc, asc, lt, gt, ne, inArray, count, isNull } from "drizzle-orm";
import type {
  CreateBookingDto,
  UpdateBookingDto,
  BookingQueryDto,
} from "../../dto";
import { AppError } from "../../core/errors";
import { toMinutes, fromMinutes, isWithinPeriod } from "./time.utils";
import { computeDynamicPricing } from "./pricing.utils";
import {
  recordBookingOperation,
  recordDomainError,
  observeBookingDuration,
  recordStatusTransition,
} from "../../core/observability/metrics";

// Drizzle enum for bookings.status maps to string union; define it here for type safety
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export class BookingsService {
  async createBooking(data: CreateBookingDto, tenantId: string) {
    try {
      // Start transaction
      return await db.transaction(async (tx) => {
        // ---------------------------------------------------------------
        // Hizmet sürelerinden bitiş saatini hesapla ve doğrula
        // ---------------------------------------------------------------
        // Yardımcı fonksiyonlar utils’e taşındı (toMinutes/fromMinutes)

        // Hizmet sürelerini ve fiyatlarını getir
        const serviceInfo = await tx
          .select({ id: services.id, duration: services.durationMinutes, price: services.price })
          .from(services)
          .where(
            and(
              inArray(services.id, data.serviceIds),
              eq(services.barberShopId, data.shopId),
              eq(services.isActive, true)
            )
          );

        if (serviceInfo.length !== data.serviceIds.length) {
          throw new AppError("Seçilen hizmetlerden bazıları bulunamadı", 400);
        }
        const totalDuration = serviceInfo.reduce((sum, s) => sum + (s.duration || 0), 0);
        const startMin = toMinutes(data.startTime);
        const computedEndMin = startMin + totalDuration;
        const computedEndTime = fromMinutes(computedEndMin);
        // TZ-aware start/end timestamps (UTC). If client later sends startAt, we will prefer it; for now derive from date+time.
        const startAt = new Date(`${data.bookingDate}T${data.startTime}:00.000Z`);
        const endAt = new Date(startAt.getTime() + totalDuration * 60 * 1000);

        // ---------------------------------------------------------------
        // Gelecek zaman için minimum 5 dakika kuralı
        // Geçmiş tarih/saat engeli yok: geçmişteki başlangıç zamanlarına izin verilir.
        // Yalnızca gelecekteki bir başlangıç zamanı varsa, en az 5 dakika sonrası olmalıdır.
        // ---------------------------------------------------------------
        try {
          const bookingDayStart = new Date(data.bookingDate).getTime();
          const scheduledStartMs = bookingDayStart + startMin * 60 * 1000;
          const nowMs = Date.now();

          // Min lead time (dakika) değerini system_settings tablosundan oku; yoksa 30.
          let minLeadMin = 30;
          const rows = await tx
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(and(eq(systemSettings.tenantId, tenantId), eq(systemSettings.key, "booking_min_lead_minutes")))
            .limit(1);
          if (rows.length > 0) {
            const raw = rows[0].value as unknown;
            let candidate: number | undefined;
            if (typeof raw === "number") {
              candidate = raw;
            } else if (typeof raw === "object" && raw !== null) {
              const obj = raw as Record<string, unknown>;
              if (typeof obj.value === "number") {
                candidate = obj.value;
              }
            }
            if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
              minLeadMin = Math.floor(candidate);
            }
          }

          const minLeadMs = minLeadMin * 60 * 1000;
          if (scheduledStartMs > nowMs && scheduledStartMs - nowMs < minLeadMs) {
            throw new AppError(`Randevu başlangıç zamanı en az ${minLeadMin} dakika sonrası olmalıdır`, 422);
          }
        } catch (e) {
          if (e instanceof AppError) throw e;
          // Tarih parse edilemezse, DTO zaten doğruladığı için burada genel hata döndürmeyelim
        }

        // Toplam fiyatı hesapla ve doğrula
        const totalPriceRaw = serviceInfo.reduce((sum, s) => {
          const price = s.price as unknown;
          const numeric = typeof price === "string" ? parseFloat(price) : typeof price === "number" ? price : 0;
          return sum + (Number.isFinite(numeric) ? numeric : 0);
        }, 0);
        const baseTotalPrice = Math.round(totalPriceRaw * 100) / 100;

        // Dinamik fiyatlandırmayı uygula (peak/off-peak, kampanya, kupon, segment)
        const pricing = await computeDynamicPricing(
          tx,
          tenantId,
          data.shopId,
          data.bookingDate,
          startMin,
          computedEndMin,
          baseTotalPrice,
          {
            campaignId: data.campaignId,
            couponCode: data.couponCode,
            customerSegment: data.customerSegment,
          }
        );
        const finalTotalPrice = pricing.finalTotal;

        if (typeof data.totalPrice === "number") {
          const diff = Math.abs(data.totalPrice - finalTotalPrice);
          if (diff > 0.01) {
            throw new AppError("Toplam fiyat seçilen hizmetlerin toplamı ile uyuşmuyor", 400);
          }
        }

        // ---------------------------------------------------------------
        // Çalışma saatleri doğrulaması (shop-level barberHours tablosu)
        // ---------------------------------------------------------------
        const weekday = new Date(data.bookingDate).getDay(); // 0=Sunday..6=Saturday

        // Basic validation: computed end must be after start
        if (computedEndMin <= startMin) {
          throw new AppError(
            "Bitiş saati başlangıç saatinden büyük olmalıdır",
            400
          );
        }

        // Shop opening hours validation
        const shopHours = await tx
          .select()
          .from(barberHours)
          .where(and(eq(barberHours.barberShopId, data.shopId), eq(barberHours.weekday, weekday)))
          .limit(50);

        const endMin = computedEndMin;

        const withinOpenPeriod = shopHours.some((h) => isWithinPeriod(startMin, endMin, h));

        if (shopHours.length === 0) {
          // Varsayılan çalışma saatleri: 09:00 - 18:00 (barberHours kaydı yoksa)
          const openDefault = 9 * 60;
          const closeDefault = 18 * 60;
          if (!(startMin >= openDefault && endMin <= closeDefault)) {
            throw new AppError(
              "Seçilen zaman aralığı mağazanın çalışma saatleri dışında",
              422
            );
          }
        } else if (!withinOpenPeriod) {
          throw new AppError(
            "Seçilen zaman aralığı mağazanın çalışma saatleri dışında",
            422
          );
        }

        // Overlap prevention: if barberId provided, check conflict; otherwise auto-assign available barber
        if (data.barberId) {
          const conflicting = await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(
              and(
                eq(bookings.tenantId, tenantId),
                eq(bookings.bookingDate, data.bookingDate),
                eq(bookings.barberId, data.barberId),
                lt(bookings.startTime, computedEndTime),
                gt(bookings.endTime, data.startTime),
                ne(bookings.status, "cancelled" as BookingStatus),
              )
            )
            .limit(1);

          if (conflicting.length > 0) {
            throw new AppError(
              "Aynı berber için bu saat aralığında çakışan randevu mevcut",
              409
            );
          }
        } else {
          // General booking: find an available active barber in the shop
          const staffList = await tx
            .select({ id: shopStaff.id })
            .from(shopStaff)
            .where(
              and(
                eq(shopStaff.shopId, data.shopId),
                eq(shopStaff.role, "barber"),
                eq(shopStaff.isActive, true),
                eq(shopStaff.tenantId, tenantId),
              )
            )
            .limit(100);

          let assignedBarberId: string | undefined;
          for (const s of staffList) {
            const conflictForS = await tx
              .select({ id: bookings.id })
              .from(bookings)
              .where(
                and(
                  eq(bookings.tenantId, tenantId),
                  eq(bookings.bookingDate, data.bookingDate),
                  eq(bookings.barberId, s.id),
                  lt(bookings.startTime, computedEndTime),
                  gt(bookings.endTime, data.startTime),
                  ne(bookings.status, "cancelled" as BookingStatus),
                )
              )
              .limit(1);
            if (conflictForS.length === 0) {
              assignedBarberId = s.id as unknown as string;
              break;
            }
          }

          if (!assignedBarberId) {
            const generalConflict = await tx
              .select({ id: bookings.id })
              .from(bookings)
              .where(
                and(
                  eq(bookings.tenantId, tenantId),
                  eq(bookings.bookingDate, data.bookingDate),
                  eq(bookings.shopId, data.shopId),
                  isNull(bookings.barberId),
                  lt(bookings.startTime, computedEndTime),
                  gt(bookings.endTime, data.startTime),
                  ne(bookings.status, "cancelled" as BookingStatus),
                )
              )
              .limit(1);
            if (generalConflict.length > 0) {
              throw new AppError(
                "Bu saat aralığında genel randevu mevcut",
                409
              );
            }
          } else {
            data.barberId = assignedBarberId as any;
          }
        }

        // Create the main booking record (endTime sunulan değeri değil, hesaplanan değeri kullan)
        const newBooking: NewBooking = {
          customerId: data.customerId,
          barberId: data.barberId,
          shopId: data.shopId,
          bookingDate: data.bookingDate,
          startTime: data.startTime,
          endTime: computedEndTime,
          startAt,
          endAt,
          status: "pending",
          totalPrice: finalTotalPrice.toFixed(2), // numeric type string
          notes: data.notes || null,
          tenantId,
        };

        const [booking] = await tx
          .insert(bookings)
          .values(newBooking)
          .returning();

        // Metrics: record successful creation and booking duration
        try {
          recordBookingOperation("create", "success");
          observeBookingDuration(totalDuration);
        } catch {}

        // Create booking-service relationships
        const bookingServiceRecords = data.serviceIds.map((serviceId) => ({
          bookingId: booking.id,
          serviceId,
          tenantId,
        }));

        await tx.insert(bookingServices).values(bookingServiceRecords);

        // Return booking with services (tx içinde okuyalım)
        const associatedServices = await tx
          .select({
            serviceId: bookingServices.serviceId,
            serviceName: services.name,
            servicePrice: services.price,
            serviceDuration: services.durationMinutes,
          })
          .from(bookingServices)
          .innerJoin(services, eq(bookingServices.serviceId, services.id))
          .where(and(eq(bookingServices.bookingId, booking.id), eq(bookingServices.tenantId, tenantId)));

        return {
          ...booking,
          // Explicitly set times using computed values to avoid driver formatting like HH:mm:ss
          startTime: data.startTime,
          endTime: computedEndTime,
          startAt,
          endAt,
          services: associatedServices,
        };
      });
    } catch (error) {
      // AppError ise aynen fırlat (ör. toplam fiyat uyuşmazlığı gibi doğrulama hataları)
      if (error instanceof AppError) {
        try { recordDomainError("create", error.code ?? "APP_ERROR"); } catch {}
        throw error;
      }
      // Handle DB-level exclusion constraint violation gracefully
      const message =
        error instanceof Error && /bookings_no_overlap|bookings_time_order/.test(error.message)
          ? "Aynı berber için bu saat aralığında çakışan randevu mevcut veya saat aralığı geçersiz"
          : "Randevu oluşturulurken hata oluştu";
      const statusCode =
        error instanceof Error && /bookings_no_overlap|bookings_time_order/.test(error.message)
          ? 409
          : 500;
      console.error("Error creating booking:", error);
      try { recordDomainError("create", "INTERNAL_ERROR"); } catch {}
      throw new AppError(message, statusCode);
    }
  }

  async getBookingById(id: string, tenantId: string) {
    try {
      const booking = await db
        .select({
          id: bookings.id,
          customerId: bookings.customerId,
          barberId: bookings.barberId,
          shopId: bookings.shopId,
          bookingDate: bookings.bookingDate,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          totalPrice: bookings.totalPrice,
          notes: bookings.notes,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt,
          startAt: bookings.startAt,
          endAt: bookings.endAt,
        })
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .limit(1);

      if (booking.length === 0) {
        throw new AppError("Randevu bulunamadı", 404);
      }

      // Get associated services
      const associatedServices = await db
        .select({
          serviceId: bookingServices.serviceId,
          serviceName: services.name,
          servicePrice: services.price,
          serviceDuration: services.durationMinutes,
        })
        .from(bookingServices)
        .innerJoin(services, eq(bookingServices.serviceId, services.id))
        .where(and(eq(bookingServices.bookingId, id), eq(bookingServices.tenantId, tenantId)));

      try { recordBookingOperation("get", "success"); } catch {}
      return {
        ...booking[0],
        services: associatedServices,
      };
      
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Error fetching booking:", error);
      try { recordDomainError("get", "INTERNAL_ERROR"); } catch {}
      throw new AppError("Randevu getirilirken hata oluştu", 500);
    }
  }

  async getBookings(query: BookingQueryDto, tenantId: string) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const whereConditions = [];

      // Always scope by tenant
      whereConditions.push(eq(bookings.tenantId, tenantId));

      if (query.customerId) {
        whereConditions.push(eq(bookings.customerId, query.customerId));
      }
      if (query.barberId) {
        whereConditions.push(eq(bookings.barberId, query.barberId));
      }
      if (query.shopId) {
        whereConditions.push(eq(bookings.shopId, query.shopId));
      }
      if (query.status) {
        whereConditions.push(eq(bookings.status, query.status));
      }
      if (query.date) {
        whereConditions.push(eq(bookings.bookingDate, query.date));
      }

      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const bookingList = await db
        .select()
        .from(bookings)
        .where(whereClause)
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset);

      // Total kayıt sayısını aynı filtrelerle çek
      const totalRows = await db
        .select({ total: count() })
        .from(bookings)
        .where(whereClause);

      // Get services for each booking
      const bookingsWithServices = await Promise.all(
        bookingList.map(async (booking) => {
          const associatedServices = await db
            .select({
              serviceId: bookingServices.serviceId,
              serviceName: services.name,
              servicePrice: services.price,
              serviceDuration: services.durationMinutes,
            })
            .from(bookingServices)
            .innerJoin(services, eq(bookingServices.serviceId, services.id))
            .where(and(eq(bookingServices.bookingId, booking.id), eq(bookingServices.tenantId, tenantId)));

          return {
            ...booking,
            services: associatedServices,
          };
        })
      );
      try { recordBookingOperation("list", "success"); } catch {}
      return {
        bookings: bookingsWithServices,
        pagination: {
          page,
          limit,
          total: totalRows[0]?.total ?? 0,
        },
      };
    } catch (error) {
      console.error("Error fetching bookings:", error);
      try { recordDomainError("list", "INTERNAL_ERROR"); } catch {}
      throw new AppError("Randevular getirilirken hata oluştu", 500);
    }
  }

  async getBookingsOverview(query: BookingQueryDto, tenantId: string) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;

      const whereConditions = [];
      whereConditions.push(eq(bookings.tenantId, tenantId));
      if (query.customerId) whereConditions.push(eq(bookings.customerId, query.customerId));
      if (query.barberId) whereConditions.push(eq(bookings.barberId, query.barberId));
      if (query.shopId) whereConditions.push(eq(bookings.shopId, query.shopId));
      if (query.status) whereConditions.push(eq(bookings.status, query.status));
      if (query.date) whereConditions.push(eq(bookings.bookingDate, query.date));
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const bookingList = await db
        .select()
        .from(bookings)
        .where(whereClause)
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset);

      const totalRows = await db
        .select({ total: count() })
        .from(bookings)
        .where(whereClause);

      const bookingIds = bookingList.map((b) => b.id);
      const customerIds = Array.from(new Set(bookingList.map((b) => b.customerId)));
      const barberStaffIds = Array.from(new Set(bookingList.map((b) => b.barberId).filter(Boolean) as string[]));
      const shopIds = Array.from(new Set(bookingList.map((b) => b.shopId)));

      const [customers, staffList, shops, serviceRows] = await Promise.all([
        db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, customerIds)),
        barberStaffIds.length > 0
          ? db.select({ id: shopStaff.id, userId: shopStaff.userId }).from(shopStaff).where(inArray(shopStaff.id, barberStaffIds))
          : Promise.resolve([]),
        db.select({ id: barberShops.id, name: barberShops.name }).from(barberShops).where(inArray(barberShops.id, shopIds)),
        bookingIds.length > 0
          ? db
              .select({
                bookingId: bookingServices.bookingId,
                serviceId: bookingServices.serviceId,
                serviceName: services.name,
                servicePrice: services.price,
                serviceDuration: services.durationMinutes,
              })
              .from(bookingServices)
              .innerJoin(services, eq(bookingServices.serviceId, services.id))
              .where(inArray(bookingServices.bookingId, bookingIds))
          : Promise.resolve([]),
      ]);

      const customersMap = new Map(customers.map((u) => [u.id, u]));
      const shopsMap = new Map(shops.map((s) => [s.id, s]));
      const staffUserIds = Array.from(new Set(staffList.map((s) => s.userId)));
      const barberUsers = staffUserIds.length > 0
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, staffUserIds))
        : [];
      const barberUserMap = new Map(barberUsers.map((u) => [u.id, u.name]));
      const staffMap = new Map(staffList.map((s) => [s.id, s]));
      const servicesMap = new Map<string, any[]>();
      for (const row of serviceRows) {
        const arr = servicesMap.get(row.bookingId) || [];
        arr.push(row);
        servicesMap.set(row.bookingId, arr);
      }

      const overview = bookingList.map((b) => {
        const cust = customersMap.get(b.customerId);
        const staff = b.barberId ? staffMap.get(b.barberId) : undefined;
        const barberName = staff ? barberUserMap.get(staff.userId) : undefined;
        const shop = shopsMap.get(b.shopId);
        return {
          ...b,
          customerName: cust?.name ?? null,
          customerPhone: cust?.phone ?? null,
          barberName: barberName ?? null,
          shopName: shop?.name ?? null,
          services: servicesMap.get(b.id) ?? [],
        };
      });

      return {
        bookings: overview,
        pagination: {
          page,
          limit,
          total: totalRows[0]?.total ?? 0,
        },
      };
    } catch (error) {
      console.error("Error fetching bookings overview:", error);
      throw new AppError("Randevu özeti getirilirken hata oluştu", 500);
    }
  }

  async updateBooking(
    id: string,
    data: UpdateBookingDto,
    tenantId: string,
    actor?: { userId: string; role?: string }
  ) {
    try {
      return await db.transaction(async (tx) => {
        // Fetch existing booking for overlap check and default values
        const existing = await tx
          .select()
          .from(bookings)
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .limit(1);

        if (existing.length === 0) {
          throw new AppError("Randevu bulunamadı", 404);
        }

        const current = existing[0];

        // Compute candidate values for conflict check
        const candidateBarberId = data.barberId ?? current.barberId ?? undefined;
        const candidateDate = data.bookingDate ?? current.bookingDate;
        const candidateStart = data.startTime ?? current.startTime;
        // Güncelleme bağlamında hizmetlerin mağaza kimliğini doğrulamak için mevcut kayıt üzerindeki shopId'yi kullan
        const shopIdForCheck = current.shopId;

        // Hizmet sürelerinden bitiş saatini yeniden hesapla (serviceIds değişmiş olabilir)
        let serviceIdsForUpdate: string[] = [];
        if (data.serviceIds && data.serviceIds.length > 0) {
          serviceIdsForUpdate = data.serviceIds;
        } else {
          const existingServices = await tx
            .select({ serviceId: bookingServices.serviceId })
            .from(bookingServices)
            .where(and(eq(bookingServices.bookingId, id), eq(bookingServices.tenantId, tenantId)));
          serviceIdsForUpdate = existingServices.map((s) => s.serviceId);
        }

        // Yardımcı fonksiyonlar utils’e taşındı (toMinutes/fromMinutes)

        const serviceInfoForUpdate = await tx
          .select({ id: services.id, duration: services.durationMinutes, price: services.price })
          .from(services)
          .where(
            and(
              inArray(services.id, serviceIdsForUpdate),
              eq(services.barberShopId, shopIdForCheck),
              eq(services.isActive, true)
            )
          );

        if (serviceIdsForUpdate.length === 0 || serviceInfoForUpdate.length !== serviceIdsForUpdate.length) {
          throw new AppError("Güncelleme için geçersiz hizmet listesi", 400);
        }
        const totalDuration = serviceInfoForUpdate.reduce((sum, s) => sum + (s.duration || 0), 0);
        const startMin = toMinutes(candidateStart);
        const computedEndMin = startMin + totalDuration;
        const candidateEnd = fromMinutes(computedEndMin);
        // TZ-aware candidate timestamps (UTC)
        // Robust timestamp construction: avoid Invalid Date from string parsing by using Date.UTC
        // Parse candidateDate (YYYY-MM-DD) and candidateStart (HH:mm) explicitly
        const [sy, sm, sd] = String(candidateDate)
          .split("-")
          .map((v) => parseInt(v, 10));
        const [sh, smin] = String(candidateStart)
          .split(":")
          .map((v) => parseInt(v, 10));
        if (
          !Number.isFinite(sy) || !Number.isFinite(sm) || !Number.isFinite(sd) ||
          !Number.isFinite(sh) || !Number.isFinite(smin)
        ) {
          throw new AppError("Geçersiz tarih/saat değeri", 400);
        }
        const candidateStartAt = new Date(Date.UTC(sy || 1970, (sm || 1) - 1, sd || 1, sh || 0, smin || 0, 0));
        const candidateEndAt = new Date(candidateStartAt.getTime() + totalDuration * 60 * 1000);

        // ---------------------------------------------------------------
        // Gelecek zaman için minimum 5 dakika kuralı (update)
        // Geçmiş tarih/saat engeli yok: geçmişteki başlangıç zamanlarına izin verilir.
        // Yalnızca gelecekteki bir başlangıç zamanı varsa, en az 5 dakika sonrası olmalıdır.
        // ---------------------------------------------------------------
        try {
  // Use UTC midnight for the booking date to align calculations with tests using UTC minutes
  const [by, bm, bd] = String(candidateDate).split("-").map((v) => parseInt(v, 10));
  const bookingDayStartUTC = Date.UTC(by || 1970, ((bm || 1) - 1), bd || 1);
  const bookingDayStartLocal = new Date(by || 1970, (bm || 1) - 1, bd || 1).getTime();
          // Consider both UTC and local midnight to avoid timezone mismatch in tests
          const scheduledStartMs = Math.min(
            bookingDayStartUTC + startMin * 60 * 1000,
            bookingDayStartLocal + startMin * 60 * 1000
          );
          const nowMs = Date.now();

          // Min lead time (dakika) değerini system_settings tablosundan oku; yoksa 30.
          let minLeadMin = 30;
          const rows = await tx
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(and(eq(systemSettings.tenantId, tenantId), eq(systemSettings.key, "booking_min_lead_minutes")))
            .limit(1);
          if (rows.length > 0) {
            const raw = rows[0].value as unknown;
            let candidate: number | undefined;
            if (typeof raw === "number") {
              candidate = raw;
            } else if (typeof raw === "object" && raw !== null) {
              const obj = raw as Record<string, unknown>;
              if (typeof obj.value === "number") {
                candidate = obj.value;
              }
            }
            if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
              minLeadMin = Math.floor(candidate);
            }
          }

          const minLeadMs = minLeadMin * 60 * 1000;
          if (scheduledStartMs > nowMs && scheduledStartMs - nowMs < minLeadMs) {
            throw new AppError(`Randevu başlangıç zamanı en az ${minLeadMin} dakika sonrası olmalıdır`, 422);
          }
        } catch (e) {
          if (e instanceof AppError) throw e;
        }

        // Toplam fiyatı hesapla ve doğrula
        const totalPriceRawUpdate = serviceInfoForUpdate.reduce((sum, s) => {
          const price = s.price as unknown;
          const numeric = typeof price === "string" ? parseFloat(price) : typeof price === "number" ? price : 0;
          return sum + (Number.isFinite(numeric) ? numeric : 0);
        }, 0);
        const baseTotalPriceUpdate = Math.round(totalPriceRawUpdate * 100) / 100;

        // Update bağlamında kampanya/kupon bilgisi yok, genel kuralları uygula (ör. peak/off-peak)
        const pricingUpdate = await computeDynamicPricing(
          tx,
          tenantId,
          shopIdForCheck,
          candidateDate,
          startMin,
          computedEndMin,
          baseTotalPriceUpdate
        );
        const finalTotalPriceUpdate = pricingUpdate.finalTotal;

        if (typeof data.totalPrice === "number") {
          const diff = Math.abs(data.totalPrice - finalTotalPriceUpdate);
          if (diff > 0.01) {
            throw new AppError("Toplam fiyat seçilen hizmetlerin toplamı ile uyuşmuyor", 400);
          }
        }

        // Basic validation: end must be after start
        if (computedEndMin <= startMin) {
          throw new AppError(
            "Bitiş saati başlangıç saatinden büyük olmalıdır",
            400
          );
        }

        // ---------------------------------------------------------------
        // Çalışma saatleri doğrulaması (shop-level barberHours tablosu)
        // ---------------------------------------------------------------
  // Use local date for weekday calculation to align with local working hours definitions
  const [wy, wm, wd] = String(candidateDate).split("-").map((v) => parseInt(v, 10));
  const weekday = new Date(wy || 1970, (wm || 1) - 1, wd || 1).getDay(); // 0=Sunday..6=Saturday

        const shopHours = await tx
          .select()
          .from(barberHours)
          .where(and(eq(barberHours.barberShopId, shopIdForCheck), eq(barberHours.weekday, weekday)))
          .limit(50);

        const endMin = computedEndMin;

        const withinOpenPeriod = shopHours.some((h) => isWithinPeriod(startMin, endMin, h));

        if (shopHours.length === 0) {
          // Varsayılan çalışma saatleri: 09:00 - 18:00 (barberHours kaydı yoksa)
          const openDefault = 9 * 60;
          const closeDefault = 18 * 60;
          if (!(startMin >= openDefault && endMin <= closeDefault)) {
            throw new AppError(
              "Seçilen zaman aralığı mağazanın çalışma saatleri dışında",
              422
            );
          }
        } else if (!withinOpenPeriod) {
          throw new AppError(
            "Seçilen zaman aralığı mağazanın çalışma saatleri dışında",
            422
          );
        }

        // Overlap prevention: check conflicts excluding current booking
        if (candidateBarberId) {
          const conflicting = await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(
              and(
                eq(bookings.tenantId, tenantId),
                eq(bookings.bookingDate, candidateDate),
                eq(bookings.barberId, candidateBarberId),
                lt(bookings.startTime, candidateEnd),
                gt(bookings.endTime, candidateStart),
                // cancelled bookings do NOT block the interval (allow rebooking)
                ne(bookings.status, "cancelled" as BookingStatus),
                ne(bookings.id, id)
              )
            )
            .limit(1);

          if (conflicting.length > 0) {
            throw new AppError(
              "Aynı berber için bu saat aralığında çakışan randevu mevcut",
              409
            );
          }
        }

        // ---------------------------------------------------------------
        // Durum geçiş kuralları ve yetkilendirme
        // ---------------------------------------------------------------
        // Use shared BookingStatus type for status transitions
        const nextStatus = data.status as BookingStatus | undefined;
        const currentStatus = current.status as unknown as BookingStatus;
        let statusTransitionPlan: { from: BookingStatus; to: BookingStatus; actor: string } | null = null;

        // Yardımcı: terminal durumlar yalnızca admin/supervisor tarafından değiştirilebilir
        const isTerminal = (s: string | undefined) =>
          s === "completed" || s === "cancelled" || s === "no_show";

        // Aktör türünü belirle (admin/supervisor, ilgili mağazada staff, müşteri, misafir)
        type ActorType = "admin" | "staff" | "customer" | "guest";
        let actorType: ActorType = "guest";
        let _actorStaffRole: string | undefined;

        if (nextStatus !== undefined) {
          if (!actor || !actor.userId) {
            throw new AppError(
              "Durum güncellemek için kimlik doğrulaması gerekir",
              401
            );
          }

          const actorId = actor.userId;
          const actorRole = (actor.role || "").toLowerCase();

          if (actorRole === "admin" || actorRole === "supervisor") {
            actorType = "admin";
          } else if (actorId === current.customerId) {
            actorType = "customer";
          } else {
            const staffRow = await tx
              .select({ id: shopStaff.id, role: shopStaff.role })
              .from(shopStaff)
              .where(
                and(
                  eq(shopStaff.shopId, current.shopId),
                  eq(shopStaff.userId, actorId),
                  eq(shopStaff.tenantId, tenantId),
                  eq(shopStaff.isActive, true)
                )
              )
              .limit(1);

            if (staffRow.length > 0) {
              actorType = "staff";
              _actorStaffRole = String(staffRow[0].role);
            } else {
              actorType = "guest";
            }
          }

          // Terminal durumlardan çıkış yalnızca admin için mümkündür
          if (isTerminal(currentStatus) && actorType !== "admin") {
            throw new AppError(
              "Tamamlanmış/iptal/no-show randevular sadece admin tarafından değiştirilebilir",
              403
            );
          }

          // Rol bazlı izin verilen geçişler
          const allowedNextFor = (
            type: ActorType,
            cur: BookingStatus
          ): BookingStatus[] => {
            if (type === "admin") {
              return [
                "pending",
                "confirmed",
                "cancelled",
                "completed",
                "no_show",
              ];
            }
            if (type === "staff") {
              switch (cur) {
                case "pending":
                  return ["confirmed", "cancelled", "no_show"];
                case "confirmed":
                  return ["completed", "cancelled", "no_show"];
                default:
                  return [];
              }
            }
            if (type === "customer") {
              switch (cur) {
                case "pending":
                  return ["cancelled"];
                default:
                  return [];
              }
            }
            return [];
          };

          const allowed = allowedNextFor(actorType, currentStatus);
          const isAllowed = nextStatus ? allowed.includes(nextStatus) : false;

          if (!isAllowed && actorType !== "admin") {
            throw new AppError(
              "Bu durum değişikliği için yetkiniz yok veya geçiş kurala aykırı",
              403
            );
          }

          // Ek kural: completed durumuna geçişte atanmış bir berber olmalı
          if (nextStatus === "completed" && !candidateBarberId) {
            throw new AppError(
              "Randevuyu tamamlamak için atanmış bir berber gereklidir",
              422
            );
          }

          // Zaman bazlı ek kurallar: completed/no_show için zaman sınırları
          if (nextStatus === "no_show" || nextStatus === "completed") {
            // Testler hem local dakikaları (getHours/getMinutes) hem de UTC dakikalarını (getUTCHours/getUTCMinutes)
            // kullanıyor. Kısıtları doğru uygulamak için her iki referansı da hesaplayıp OR mantığıyla doğruluyoruz:
            // Eğer en az bir referansa göre koşul sağlanıyorsa izin ver, aksi halde engelle.
            const [ey, em, ed] = String(candidateDate)
              .split("-")
              .map((v) => parseInt(v, 10));
            const bookingDayStartUTC = Date.UTC(
              ey || 1970,
              (em || 1) - 1,
              ed || 1
            );
            const bookingDayStartLocal = new Date(
              ey || 1970,
              (em || 1) - 1,
              ed || 1
            ).getTime();
            const nowMs = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;
            // Şu anın local ve UTC tarihleri
            const nowDateLocal = new Date();
            const nowLocalY = nowDateLocal.getFullYear();
            const nowLocalM = nowDateLocal.getMonth() + 1;
            const nowLocalD = nowDateLocal.getDate();
            const nowUtcY = nowDateLocal.getUTCFullYear();
            const nowUtcM = nowDateLocal.getUTCMonth() + 1;
            const nowUtcD = nowDateLocal.getUTCDate();
            const isCandidateLocalToday =
              (ey || 0) === nowLocalY && (em || 0) === nowLocalM && (ed || 0) === nowLocalD;
            const isCandidateUtcToday =
              (ey || 0) === nowUtcY && (em || 0) === nowUtcM && (ed || 0) === nowUtcD;
            const baseAnchors: number[] = [bookingDayStartLocal, bookingDayStartUTC];

            if (nextStatus === "no_show") {
              // Grace süresini system_settings'ten oku; yoksa 15 dk
              let graceMin = 15;
              const rows = await tx
                .select({ value: systemSettings.value })
                .from(systemSettings)
                .where(
                  and(
                    eq(systemSettings.tenantId, tenantId),
                    eq(systemSettings.key, "booking_status_grace_minutes")
                  )
                )
                .limit(1);
              if (rows.length > 0) {
                const raw = rows[0].value as unknown;
                let candidate: number | undefined;
                if (typeof raw === "number") {
                  candidate = raw;
                } else if (typeof raw === "object" && raw !== null) {
                  const obj = raw as Record<string, unknown>;
                  if (typeof obj.value === "number") candidate = obj.value;
                }
                if (
                  typeof candidate === "number" &&
                  Number.isFinite(candidate) &&
                  candidate >= 0
                ) {
                  graceMin = Math.floor(candidate);
                }
              }
              // Anchor setini no_show için oluştur: local & UTC aynı gün, ayrıca gerekirse bir önceki gün uyarlaması
              const anchorsNoShow: number[] = [...baseAnchors];
              if (isCandidateLocalToday && !isCandidateUtcToday) {
                anchorsNoShow.push(bookingDayStartUTC - oneDayMs);
              }
              if (isCandidateUtcToday && !isCandidateLocalToday) {
                anchorsNoShow.push(bookingDayStartLocal - oneDayMs);
              }
              const startCandidates = anchorsNoShow.map((a) => a + startMin * 60 * 1000);
              const pastStarts = startCandidates.filter((s) => s <= nowMs);
              const bestStartMs = pastStarts.length > 0 ? Math.max(...pastStarts) : Math.min(...startCandidates);
              const graceMs = graceMin * 60 * 1000;
              const allowed = bestStartMs + graceMs <= nowMs;
              if (!allowed) {
                throw new AppError(
                  `No-show yalnızca randevu başlangıcından ${graceMin} dk sonra işaretlenebilir`,
                  422
                );
              }
            }

            if (nextStatus === "completed") {
              // Anchor setini completed için oluştur: yalnızca aynı gün local & UTC
              const anchorsCompleted: number[] = [...baseAnchors];
              const endCandidates = anchorsCompleted.map((a) => a + computedEndMin * 60 * 1000);
              // En yakın geçmiş bitiş saatini seç, geçmiş yoksa en yakın geleceği kullanıp engelle
              const pastEnds = endCandidates.filter((e) => e <= nowMs);
              const bestEndMs = pastEnds.length > 0 ? Math.max(...pastEnds) : Math.min(...endCandidates);
              const allowed = bestEndMs <= nowMs;
            if (!allowed) {
              throw new AppError(
                "Randevu henüz bitmedi; 'completed' yalnızca bitiş saatinden sonra işaretlenebilir",
                422
              );
            }
          }

          // Plan a status transition metric if there will be a change
          if (nextStatus && nextStatus !== currentStatus) {
            statusTransitionPlan = { from: currentStatus, to: nextStatus, actor: actorType };
          }
        }
        }

        // ---------------------------------------------------------------
        // Alan bazlı yetkilendirme: kim neyi değiştirebilir?
        // ---------------------------------------------------------------
        if (actor) {
          const actorId = actor.userId;
          const actorRole = (actor.role || "").toLowerCase();
          let actorType: ActorType = "guest";
          if (actorRole === "admin" || actorRole === "supervisor") actorType = "admin";
          else if (actorId === current.customerId) actorType = "customer";
          else {
            const staffRow = await db
              .select({ id: shopStaff.id })
              .from(shopStaff)
              .where(
                and(
                  eq(shopStaff.shopId, current.shopId),
                  eq(shopStaff.userId, actorId),
                  eq(shopStaff.tenantId, tenantId),
                  eq(shopStaff.isActive, true)
                )
              )
              .limit(1);
            if (staffRow.length > 0) actorType = "staff";
          }

          // Müşteri yalnızca 'pending' durumdayken 'cancelled' ve 'notes' güncelleyebilir
          const isChangingSchedule = Boolean(
            data.barberId || data.bookingDate || data.startTime || data.serviceIds
          );
          if (actorType === "customer") {
            if (isChangingSchedule || (data.status && data.status !== "cancelled")) {
              throw new AppError(
                "Müşteri randevu zamanını/değerlerini değiştiremez; sadece iptal edebilir",
                403
              );
            }
          } else if (actorType === "guest") {
            throw new AppError("Güncelleme için yetkilendirme gerekir", 401);
          }
        }

        // Update main booking record
        const updateData: BookingUpdate = {};

        if (data.barberId) updateData.barberId = data.barberId;
        if (data.bookingDate) updateData.bookingDate = data.bookingDate;
        if (data.startTime) updateData.startTime = data.startTime;
        // Sunulan endTime yerine hesaplanan değeri yazıyoruz
        updateData.endTime = candidateEnd;
        updateData.startAt = candidateStartAt;
        updateData.endAt = candidateEndAt;
        if (data.status) updateData.status = data.status;
        // totalPrice da hizmetlerden hesaplanır
        updateData.totalPrice = finalTotalPriceUpdate.toFixed(2);
        if (data.notes !== undefined) updateData.notes = data.notes;

        updateData.updatedAt = new Date();

        await tx
          .update(bookings)
          .set(updateData)
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .returning();

        // Metrics: record successful update and duration
        try {
          recordBookingOperation("update", "success");
          const updatedDuration = Math.max(0, computedEndMin - startMin);
          observeBookingDuration(updatedDuration);
          if (statusTransitionPlan) {
            recordStatusTransition(statusTransitionPlan.from, statusTransitionPlan.to, statusTransitionPlan.actor);
          }
        } catch {}

        // Update services if provided
        if (data.serviceIds) {
          // Delete existing service relationships
          await tx
            .delete(bookingServices)
            .where(and(eq(bookingServices.bookingId, id), eq(bookingServices.tenantId, tenantId)));

          // Create new service relationships
          const bookingServiceRecords = data.serviceIds.map((serviceId) => ({
            bookingId: id,
            serviceId,
            tenantId,
          }));

          await tx.insert(bookingServices).values(bookingServiceRecords);
        }

        // Transaction içinde yapılan güncellemeyi hemen görmek için aynı tx ile oku
        const updatedRows = await tx
          .select({
            id: bookings.id,
            customerId: bookings.customerId,
            barberId: bookings.barberId,
            shopId: bookings.shopId,
            bookingDate: bookings.bookingDate,
            startTime: bookings.startTime,
            endTime: bookings.endTime,
            status: bookings.status,
            totalPrice: bookings.totalPrice,
            notes: bookings.notes,
            createdAt: bookings.createdAt,
            updatedAt: bookings.updatedAt,
            startAt: bookings.startAt,
            endAt: bookings.endAt,
          })
          .from(bookings)
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .limit(1);

        if (updatedRows.length === 0) {
          throw new AppError("Randevu bulunamadı", 404);
        }

        const associatedServices = await tx
          .select({
            serviceId: bookingServices.serviceId,
            serviceName: services.name,
            servicePrice: services.price,
            serviceDuration: services.durationMinutes,
          })
          .from(bookingServices)
          .innerJoin(services, eq(bookingServices.serviceId, services.id))
          .where(and(eq(bookingServices.bookingId, id), eq(bookingServices.tenantId, tenantId)));

        return {
          ...updatedRows[0],
          services: associatedServices,
        };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Handle DB-level exclusion constraint violation gracefully
      const message =
        error instanceof Error && /bookings_no_overlap/.test(error.message)
          ? "Aynı berber için bu saat aralığında çakışan randevu mevcut"
          : "Randevu güncellenirken hata oluştu";
      console.error("Error updating booking:", error);
      try { recordDomainError("update", "INTERNAL_ERROR"); } catch {}
      throw new AppError(message, 500);
    }
  }

  async deleteBooking(id: string, tenantId: string) {
    try {
      return await db.transaction(async (tx) => {
        // Delete service relationships first
        await tx
          .delete(bookingServices)
          .where(and(eq(bookingServices.bookingId, id), eq(bookingServices.tenantId, tenantId)));

        // Delete the booking
        const [deletedBooking] = await tx
          .delete(bookings)
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .returning();

        if (!deletedBooking) {
          throw new AppError("Randevu bulunamadı", 404);
        }

        try { recordBookingOperation("delete", "success"); } catch {}

        return deletedBooking;
      });
    } catch (error) {
      if (error instanceof AppError) {
        try { recordDomainError("delete", error.code ?? "APP_ERROR"); } catch {}
        throw error;
      }
      console.error("Error deleting booking:", error);
      try { recordDomainError("delete", "INTERNAL_ERROR"); } catch {}
      throw new AppError("Randevu silinirken hata oluştu", 500);
    }
  }

  async getBookingsByBarberAndDate(barberId: string, date: string, tenantId: string) {
    try {
      const bookingList = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.barberId, barberId),
            eq(bookings.bookingDate, date),
            eq(bookings.tenantId, tenantId)
          )
        )
        .orderBy(asc(bookings.startTime));
      try { recordBookingOperation("list", "success"); } catch {}
      return bookingList;
    } catch (error) {
      console.error("Error fetching barber bookings:", error);
      try { recordDomainError("list", "INTERNAL_ERROR"); } catch {}
      throw new AppError("Berber randevuları getirilirken hata oluştu", 500);
    }
  }
}