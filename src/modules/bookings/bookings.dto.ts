import { z } from "zod";

// Booking status enum
export const BookingStatusSchema = z.enum([
  "pending",
  "confirmed", 
  "cancelled",
  "completed",
  "no_show"
]);

// Create booking DTO
export const CreateBookingDto = z.object({
  customerId: z.string().uuid(),
  barberId: z.string().uuid().optional(), // Genel randevu için optional
  shopId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid("Invalid service ID format")).min(1, "En az bir hizmet seçilmelidir"),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih formatı giriniz (YYYY-MM-DD)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (HH:MM)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (HH:MM)"),
  totalPrice: z.number().positive("Toplam fiyat pozitif olmalıdır"),
  notes: z.string().optional(),
});

// Update booking DTO
export const UpdateBookingDto = z.object({
  barberId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid("Invalid service ID format")).min(1).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: BookingStatusSchema.optional(),
  totalPrice: z.number().positive().optional(),
  notes: z.string().optional(),
});

// Query parameters for listing bookings
export const BookingQueryDto = z.object({
  customerId: z.string().uuid().optional(),
  barberId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  status: BookingStatusSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingDto>;
export type UpdateBookingDto = z.infer<typeof UpdateBookingDto>;
export type BookingQueryDto = z.infer<typeof BookingQueryDto>;
export type BookingStatus = z.infer<typeof BookingStatusSchema>;