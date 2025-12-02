import { Hono } from "hono";
import type { Context } from "hono";
import { BookingsService } from "./bookings.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  CreateBookingSchema,
  UpdateBookingSchema,
  BookingQuerySchema,
} from "../../dto";

import { validateDto } from "../../dto";
import { jsonOk, jsonErr } from "../../utils/api-response";
import { AppError } from "../../core/errors";
import { resolveTenantId } from "../../shared/config/index";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../core/middleware/auth.middleware";
import { db } from "../../db";
import { shopStaff, users } from "../../db/schema";
import { and, eq } from "drizzle-orm";

// Restrict status codes to a known union to satisfy TS + ESLint
type AllowedStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;
function asAllowedStatus(n: number): AllowedStatus {
  switch (n) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 422:
    case 429:
    case 500:
      return n;
    default:
      return 500;
  }
}

export const bookingsRouter = new Hono();
const bookingsService = new BookingsService();

// GET /bookings - List bookings with optional filters
bookingsRouter.get("/", optionalAuthMiddleware, async (c: Context) => {
  try {
    const query = c.req.query();
    const tenantId = resolveTenantId(c.req.header());

    // Validate query parameters
    const validation = validateDto(BookingQuerySchema, query);
    if (!validation.success) {
      return c.json(jsonErr("Validation failed"), asAllowedStatus(400));
    }
    // RBAC: Eğer aktör müşteri ise sadece kendi randevularını listele (strict tipler nedeniyle header üzerinden)
    const actorIdHeader = c.req.header("X-User-Id");
    const actorRoleHeader = c.req.header("X-User-Role");
    const actorAuthUserId =
      typeof actorIdHeader === "string" ? actorIdHeader : undefined;
    const actorRole =
      typeof actorRoleHeader === "string" ? actorRoleHeader : undefined;
    let queryPayload = validation.data;

    if (actorAuthUserId && actorRole === "customer") {
      const customerRows = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, actorAuthUserId),
            eq(users.tenantId, tenantId)
          )
        )
        .limit(1);
      if (customerRows.length > 0) {
        queryPayload = { ...queryPayload, customerId: customerRows[0].id.toString() };
      }
    }

    const result = await bookingsService.getBookings(queryPayload, tenantId);

    return c.json(
      jsonOk({
        bookings: result.bookings,
        pagination: result.pagination,
      })
    );
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return c.json(jsonOk({ bookings: [], pagination: { page: 1, limit: 0, total: 0 } }));
  }
});

// GET /bookings/:id - Get booking by ID
bookingsRouter.get("/:id", optionalAuthMiddleware, async (c: Context) => {
  try {
    const id = c.req.param("id");
    const tenantId = resolveTenantId(c.req.header());

    if (!id) {
      return c.json(jsonErr("Randevu ID'si gerekli"), 400);
    }

    const booking = await bookingsService.getBookingById(id, tenantId);

    // RBAC: Eğer aktör müşteri ise sadece kendi randevusunu görebilir (strict tipler nedeniyle header üzerinden)
    const actorIdHeader = c.req.header("X-User-Id");
    const actorRoleHeader = c.req.header("X-User-Role");
    const actorAuthUserId =
      typeof actorIdHeader === "string" ? actorIdHeader : undefined;
    const actorRole =
      typeof actorRoleHeader === "string" ? actorRoleHeader : undefined;
    if (booking && actorAuthUserId && actorRole === "customer") {
      const customerRows = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, actorAuthUserId),
            eq(users.tenantId, tenantId)
          )
        )
        .limit(1);
      const selfId = customerRows.length > 0 ? customerRows[0].id : undefined;
      if (selfId && booking.customerId !== selfId.toString()) {
        return c.json(
          jsonErr("Bu randevuyu görüntüleme yetkiniz yok"),
          asAllowedStatus(403)
        );
      }
    }

    return c.json(jsonOk(booking));
  } catch (error) {
    console.error("Error fetching booking:", error);

    return c.json(jsonOk({ bookings: [], pagination: { page: 1, limit: 0, total: 0 } }));
  }
});

// POST /bookings - Create new booking
bookingsRouter.post("/", optionalAuthMiddleware, async (c: Context) => {
  try {
    const body = await c.req.json();
    const tenantId = resolveTenantId(c.req.header());

    // Validate request body
    const validation = validateDto(CreateBookingSchema, body);
    if (!validation.success) {
      return c.json(jsonErr("Validation failed"), asAllowedStatus(400));
    }

    // Aktör bilgisi (kimlik ve rol) - Context tipleri strict olduğundan header üzerinden aktör bilgisini alıyoruz
    const actorIdHeader = c.req.header("X-User-Id");
    const actorRoleHeader = c.req.header("X-User-Role");
    const actorAuthUserId =
      typeof actorIdHeader === "string" ? actorIdHeader : undefined;
    const actorRole =
      typeof actorRoleHeader === "string" ? actorRoleHeader : undefined;

    // 1) Müşteri kimliğini belirle ve doğrula
    let effectiveCustomerId = validation.data.customerId; // backend users.id

    if (actorAuthUserId && actorRole === "customer") {
      // Token'dan gelen auth user'ı backend users tablosuna map et
      const customerRows = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, actorAuthUserId),
            eq(users.tenantId, tenantId)
          )
        )
        .limit(1);

      if (customerRows.length === 0) {
        return c.json(
          jsonErr("Müşteri profili bulunamadı"),
          asAllowedStatus(404)
        );
      }

      effectiveCustomerId = customerRows[0].id.toString();

      // Eğer body içinde farklı bir customerId verilmişse görmezden gel veya engelle
      if (
        validation.data.customerId &&
        validation.data.customerId !== effectiveCustomerId
      ) {
        // Müşteri kendi adına randevu oluşturabilir; farklı ID kullanımı yasak
        return c.json(
          jsonErr("Müşteri kendi adına randevu oluşturabilir"),
          asAllowedStatus(403)
        );
      }
    } else {
      // Token yok veya rol customer değilse, body.customerId'yi doğrula
      const customerRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, effectiveCustomerId), eq(users.tenantId, tenantId)))
        .limit(1);

      if (customerRows.length === 0) {
        return c.json(jsonErr("Müşteri bulunamadı"), asAllowedStatus(404));
      }

      // Local kullanıcı var ve tenant uyumlu, ek dış doğrulama yapılmıyor
    }

    // 2) Berber (shop_staff) doğrulaması
    // Genel randevu (berbersiz) desteği: barberId opsiyoneldir.
    // Eğer barberId gönderilmişse doğrula; gönderilmemişse bu adımı atla.
    let staffRecord: typeof shopStaff.$inferSelect | undefined;
    if (validation.data.barberId) {
      const staffRows = await db
        .select()
        .from(shopStaff)
        .where(
          and(
            eq(shopStaff.id, validation.data.barberId as string),
            eq(shopStaff.tenantId, tenantId),
            eq(shopStaff.isActive, true)
          )
        )
        .limit(1);

      if (staffRows.length === 0) {
        return c.json(
          jsonErr("Berber bulunamadı veya pasif"),
          asAllowedStatus(404)
        );
      }
      staffRecord = staffRows[0];
      if (staffRecord.shopId !== validation.data.shopId) {
        return c.json(
          jsonErr("Berber seçilen mağazaya ait değil"),
          asAllowedStatus(400)
        );
      }
      if (staffRecord.role !== "barber") {
        return c.json(
          jsonErr("Seçilen personel berber rolünde değil"),
          asAllowedStatus(400)
        );
      }
    }

    // 3) Güvenli veri seti ile oluştur
    const bookingPayload = {
      ...validation.data,
      customerId: effectiveCustomerId,
      barberId: staffRecord?.id, // opsiyonel
      shopId: staffRecord?.shopId ?? validation.data.shopId, // güvence: barber doğrulandıysa kayıtlı shopId’yi kullan
    };

    const booking = await bookingsService.createBooking(
      bookingPayload,
      tenantId
    );

    try {
      const notifications = new NotificationsService();
      const when = `${validation.data.bookingDate} ${validation.data.startTime}`;
      await notifications.createInAppNotification(
        {
          userId: effectiveCustomerId,
          title: "Randevu oluşturuldu",
          message: `Randevunuz ${when} tarihinde oluşturuldu.`,
          type: "booking",
          link: "/dashboard/appointments",
        },
        tenantId
      );
    } catch {}

    return c.json(jsonOk(booking), 201);
  } catch (error) {
    console.error("Error creating booking:", error);

    if (error instanceof AppError) {
      return c.json(jsonErr(error.message), asAllowedStatus(error.status));
    }

    return c.json(jsonErr("Randevu oluşturulurken hata oluştu"), 500);
  }
});

// PUT /bookings/:id - Update booking
bookingsRouter.put("/:id", authMiddleware, async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const tenantId = resolveTenantId(c.req.header());

    if (!id) {
      return c.json(jsonErr("Randevu ID'si gerekli"), 400);
    }

    // Validate request body
    const validation = validateDto(UpdateBookingSchema, body);
    if (!validation.success) {
      return c.json(jsonErr("Validation failed"), asAllowedStatus(400));
    }

    // Aktör bilgisi (kimlik ve rol) - optionalAuth ile context'e düşer
    // Context tipleri strict olduğundan header üzerinden aktör bilgisini alıyoruz
    const actorIdHeader = c.req.header("X-User-Id");
    const actorRoleHeader = c.req.header("X-User-Role");
    const actorId =
      typeof actorIdHeader === "string" ? actorIdHeader : undefined;
    const actorRole =
      typeof actorRoleHeader === "string" ? actorRoleHeader : undefined;

    const booking = await bookingsService.updateBooking(
      id,
      validation.data,
      tenantId,
      actorId ? { userId: actorId, role: actorRole } : undefined
    );

    return c.json(jsonOk(booking));
  } catch (error) {
    console.error("Error updating booking:", error);

    if (error instanceof AppError) {
      return c.json(jsonErr(error.message), asAllowedStatus(error.status));
    }

    return c.json(jsonErr("Randevu güncellenirken hata oluştu"), 500);
  }
});

// DELETE /bookings/:id - Delete booking
bookingsRouter.delete("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const tenantId = resolveTenantId(c.req.header());

    if (!id) {
      return c.json(jsonErr("Randevu ID'si gerekli"), 400);
    }

    await bookingsService.deleteBooking(id, tenantId);

    return c.json(jsonOk(null));
  } catch (error) {
    console.error("Error deleting booking:", error);

    if (error instanceof AppError) {
      return c.json(jsonErr(error.message), asAllowedStatus(error.status));
    }

    return c.json(jsonErr("Randevu silinirken hata oluştu"), 500);
  }
});

// GET /bookings/barber/:barberId/date/:date - Get bookings for a barber on a specific date
bookingsRouter.get("/barber/:barberId/date/:date", async (c: Context) => {
  try {
    const barberId = c.req.param("barberId");
    const date = c.req.param("date");
    const tenantId = resolveTenantId(c.req.header());

    if (!barberId || !date) {
      return c.json(jsonErr("Berber ID'si ve tarih gerekli"), 400);
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json(
        jsonErr("Geçersiz tarih formatı. YYYY-MM-DD formatında olmalıdır."),
        400
      );
    }

    const bookings = await bookingsService.getBookingsByBarberAndDate(
      barberId,
      date,
      tenantId
    );

    return c.json(jsonOk(bookings));
  } catch (error) {
    console.error("Error fetching barber bookings:", error);

    if (error instanceof AppError) {
      return c.json(jsonErr(error.message), asAllowedStatus(error.status));
    }

    return c.json(jsonErr("Berber randevuları getirilirken hata oluştu"), 500);
  }
});
// GET /bookings/overview - Rich view with joined names
bookingsRouter.get("/overview", optionalAuthMiddleware, async (c: Context) => {
  try {
    const query = c.req.query();
    const tenantId = resolveTenantId(c.req.header());
    const validation = validateDto(BookingQuerySchema, query);
    if (!validation.success) {
      return c.json(jsonErr("Validation failed"), asAllowedStatus(400));
    }
    const result = await bookingsService.getBookingsOverview(validation.data, tenantId);
    return c.json(jsonOk(result));
  } catch (error) {
    console.error("Error fetching bookings overview:", error);
    return c.json(jsonErr("Randevu özeti getirilirken hata oluştu"), 500);
  }
});
