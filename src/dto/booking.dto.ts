import { z } from "zod";
//import { BookingStatusType } from "@shared/db/schema";

// ============================================================================
// BOOKING DTO SCHEMAS
// ============================================================================

// ISO tarih ve 24 saat formatı için regexler
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const TIME_24H_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/; // HH:MM
// ISO 8601 date-time doğrulaması (geniş kabul). Zod'un .datetime() kullanımı yerine
// Date.parse ile kontrol uyguluyoruz; bu sayede farklı varyasyonlar desteklenir.
const isIsoDateTime = (v: string) => !Number.isNaN(Date.parse(v));

export const CreateBookingSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID format"),
  barberId: z.string().uuid("Invalid barber ID format").optional(),
  shopId: z.string().uuid("Invalid shop ID format"),
  bookingDate: z.string().regex(ISO_DATE_RE, "Invalid date format (YYYY-MM-DD)"),
  startTime: z.string().regex(TIME_24H_RE, "Invalid time format (HH:MM 24h)"),
  // endTime istemciden gelmemeli; sunucu seçilen hizmetlerin sürelerinden hesaplar
  endTime: z.string().regex(TIME_24H_RE, "Invalid time format (HH:MM 24h)").optional(),
  // Opsiyonel: ISO 8601 date-time (UTC önerilir). Geçiş sürecinde kullanıma açılıyor.
  startAt: z.string().refine(isIsoDateTime, "Invalid date-time format (ISO 8601)").optional(),
  endAt: z.string().refine(isIsoDateTime, "Invalid date-time format (ISO 8601)").optional(),
  // totalPrice güvenlik için sunucuda hesaplanır; sağlanırsa doğrulanır
  totalPrice: z.number().positive("Total price must be positive").optional(),
  // Dinamik fiyatlandırma bağlamı (opsiyonel)
  campaignId: z.string().optional(),
  couponCode: z.string().optional(),
  customerSegment: z.string().optional(),
  notes: z.string().optional(),
  serviceIds: z.array(z.string().uuid("Invalid service ID")).min(1, "At least one service is required")
});

export const UpdateBookingSchema = z.object({
  barberId: z.string().uuid("Invalid barber ID format").optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"] as const).optional(),
  bookingDate: z.string().regex(ISO_DATE_RE, "Invalid date format (YYYY-MM-DD)").optional(),
  startTime: z.string().regex(TIME_24H_RE, "Invalid time format (HH:MM 24h)").optional(),
  endTime: z.string().regex(TIME_24H_RE, "Invalid time format (HH:MM 24h)").optional(),
  // Opsiyonel: ISO 8601 date-time alanları (UTC önerilir)
  startAt: z.string().refine(isIsoDateTime, "Invalid date-time format (ISO 8601)").optional(),
  endAt: z.string().refine(isIsoDateTime, "Invalid date-time format (ISO 8601)").optional(),
  totalPrice: z.number().positive("Total price must be positive").optional(),
  notes: z.string().optional(),
  serviceIds: z.array(z.string().uuid("Invalid service ID")).min(1, "At least one service is required").optional()
});

export const BookingQuerySchema = z.object({
  customerId: z.string().uuid("Invalid customer ID format").optional(),
  barberId: z.string().uuid("Invalid barber ID format").optional(),
  shopId: z.string().uuid("Invalid shop ID format").optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"] as const).optional(),
  date: z.string().regex(ISO_DATE_RE, "Invalid date format (YYYY-MM-DD)").optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingDto = z.infer<typeof UpdateBookingSchema>;
export type BookingQueryDto = z.infer<typeof BookingQuerySchema>;