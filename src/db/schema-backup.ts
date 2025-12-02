import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
  date,
  time,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Auth tabloları - artık backend içinde entegre
export const userRole = pgEnum("user_role", ["admin", "supervisor", "barber", "customer"]);
export const shopGender = pgEnum("shop_gender", ["male", "female", "unisex"]);
export const userGender = pgEnum("user_gender", ["male", "female", "other"]);

// Kuaforun-backend user tablosu - artık auth bilgilerini de içeriyor
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default('customer'),
    tenantId: text("tenant_id").notNull(),
    // Additional fields added via migration
    email: varchar("email", { length: 320 }).unique(),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    registrationApprovedAt: timestamp("registration_approved_at", { withTimezone: true }),
    gender: text("gender", { enum: ["male", "female", "other"] }),
    profileImageUrl: text("profile_image_url"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
    bio: text("bio"),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }),
    preferences: jsonb("preferences"),
    authUserId: uuid("auth_user_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    tenantIdx: uniqueIndex("users_tenant_idx").on(table.tenantId),
    phoneIdx: uniqueIndex("users_phone_idx").on(table.phone),
    authUserIdIdx: uniqueIndex("users_auth_user_id_idx").on(table.authUserId),
  })
);

// Barber shops (berber dükkanları)
export const barberShops = pgTable(
  "barber_shops",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    gender: shopGender("gender").notNull().default("unisex"),
    // Dükkan sahibi kullanıcı (berber). Artık services/auth mikroservisi kullanılıyor.
    // ownerUserId: uuid("owner_user_id").references(() => users.id, {
    //   onDelete: "set null",
    // }),
    // SerpAPI/Google Maps uyumlu alanlar
    googlePlaceId: text("google_place_id"),
    formattedAddress: text("formatted_address"),
    email: varchar("email", { length: 320 }),
    website: text("website"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    openNow: boolean("open_now"),
    openingHours: jsonb("opening_hours"), // raw opening_hours (weekday_text, periods)
    types: text("types").array(), // place türleri
    serpapiRaw: jsonb("serpapi_raw"), // tüm ham payload saklamak için
    googleRating: numeric("google_rating", { precision: 3, scale: 2 }), // ör: 4.5
    googleUserRatingsTotal: integer("google_user_ratings_total"),
    priceLevel: integer("price_level"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    placeIdUnique: uniqueIndex("barber_shops_place_id_unique").on(
      table.googlePlaceId
    ),
  })
);

// Service Templates (hizmet şablonları) - standart hizmetler için
export const serviceTemplates = pgTable("service_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  gender: shopGender("gender").notNull(), // male, female, unisex
  defaultPrice: numeric("default_price", { precision: 10, scale: 2 }).notNull(),
  defaultDurationMinutes: integer("default_duration_minutes").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // saç, sakal, bakım, makyaj vb.
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Services (hizmetler) - shop'a bağlı
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  barberShopId: integer("barber_shop_id")
    .notNull()
    .references(() => barberShops.id, { onDelete: "cascade" }),
  serviceTemplateId: integer("service_template_id").references(
    () => serviceTemplates.id,
    { onDelete: "set null" }
  ), // şablondan geliyorsa referans
  name: varchar("name", { length: 200 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Barber comments (berber yorumları) - shop ve kullanıcıya bağlı
export const barberComments = pgTable("barber_comments", {
  id: serial("id").primaryKey(),
  barberShopId: integer("barber_shop_id")
    .notNull()
    .references(() => barberShops.id, { onDelete: "cascade" }),
  // userId: uuid("user_id")
  //   .notNull()
  //   .references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1..5 aralığı uygulama katmanında doğrulanacak
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Dükkan sahibi yanıtları: her yoruma bir yanıt (opsiyonel) bırakılabilir
export const barberCommentReplies = pgTable("barber_comment_replies", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id")
    .notNull()
    .references(() => barberComments.id, { onDelete: "cascade" }),
  // userId: uuid("user_id")
  //   .notNull()
  //   .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Moderation status enum for replies (and potentially comments)
export const moderationStatus = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
]);

// Reply moderation records: one per reply, updated on moderation changes
export const barberCommentReplyModerations = pgTable(
  "barber_comment_reply_moderations",
  {
    id: serial("id").primaryKey(),
    replyId: integer("reply_id")
      .notNull()
      .references(() => barberCommentReplies.id, { onDelete: "cascade" }),
    status: moderationStatus("status").notNull().default("pending"),
    reason: text("reason"),
    moderatorAuthUserId: uuid("moderator_auth_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

// Reply edit history: keeps previous versions upon edits
export const barberCommentReplyHistory = pgTable(
  "barber_comment_reply_history",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => barberComments.id, { onDelete: "cascade" }),
    replyId: integer("reply_id")
      .notNull()
      .references(() => barberCommentReplies.id, { onDelete: "cascade" }),
    previousText: text("previous_text").notNull(),
    editedByAuthUserId: uuid("edited_by_auth_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

// Google/SerpAPI kaynaklı dış yorumlar için
export const reviewSource = pgEnum("review_source", [
  "google",
  "serpapi",
  "user",
]);
export const barberReviews = pgTable(
  "barber_reviews",
  {
    id: serial("id").primaryKey(),
    barberShopId: integer("barber_shop_id")
      .notNull()
      .references(() => barberShops.id, { onDelete: "cascade" }),
    source: reviewSource("source").notNull().default("google"),
    externalReviewId: text("external_review_id"),
    authorName: text("author_name"),
    authorUrl: text("author_url"),
    profilePhotoUrl: text("profile_photo_url"),
    rating: integer("rating").notNull(),
    text: text("text"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    externalUnique: uniqueIndex("barber_reviews_external_unique").on(
      table.externalReviewId
    ),
  })
);

// Fotoğraflar için ayrı tablo
export const barberPhotos = pgTable(
  "barber_photos",
  {
    id: serial("id").primaryKey(),
    barberShopId: integer("barber_shop_id")
      .notNull()
      .references(() => barberShops.id, { onDelete: "cascade" }),
    photoReference: text("photo_reference").notNull(),
    width: integer("width"),
    height: integer("height"),
    attributions: jsonb("attributions"),
    storageKey: text("storage_key"),
    storageUrl: text("storage_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopPhotoUnique: uniqueIndex("barber_photos_shop_photo_unique").on(
      table.barberShopId,
      table.photoReference
    ),
    storageKeyUnique: uniqueIndex("barber_photos_storage_key_unique").on(
      table.storageKey
    ),
  })
);

// Sistem Ayarları (global/tenant-bazlı configurable key-value)
// Gelecekte ek ayarlar için genişletilebilir. Değer JSONB içerir.
export const systemSettings = pgTable(
  "system_settings",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").notNull(),
    description: text("description"),
    // Multi-tenant ayrımı. İleride tenant-bazlı özelleştirme için kullanılır.
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    settingsUnique: uniqueIndex("system_settings_tenant_key_unique").on(
      table.tenantId,
      table.key
    ),
  })
);

// Normalize çalışma saatleri
export const barberHours = pgTable(
  "barber_hours",
  {
    id: serial("id").primaryKey(),
    barberShopId: integer("barber_shop_id")
      .notNull()
      .references(() => barberShops.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0=Sunday, 6=Saturday (Google Maps day kodlamasına uygun)
    openMinutes: integer("open_minutes").notNull(), // 0..1440 (HHmm -> dakikaya çevrilmiş)
    closeMinutes: integer("close_minutes").notNull(),
    open24h: boolean("open_24h").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    hoursUnique: uniqueIndex("barber_hours_unique").on(
      table.barberShopId,
      table.weekday,
      table.openMinutes,
      table.closeMinutes
    ),
  })
);

// userRefreshTokens tablosu da kaldırıldı - services/auth mikroservisi kullanılıyor

// Booking status enum
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

// Staff role enum
export const staffRole = pgEnum("staff_role", [
  "owner",
  "manager",
  "barber",
  "assistant",
  "reception",
]);

// Shop Staff (çalışanlar)
export const shopStaff = pgTable(
  "shop_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => barberShops.id, { onDelete: "cascade" }),
    authUserId: uuid("auth_user_id")
      .notNull()
      // Auth servisindeki kullanıcıya işaret eden profil tablosundaki benzersiz alan
      .references(() => users.authUserId, { onDelete: "cascade" }),
    role: staffRole("role").notNull().default("barber"),
    isActive: boolean("is_active").notNull().default(true),
    // Multi-tenant ayrımı
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Aynı dükkanda aynı auth kullanıcı sadece bir kez çalışabilir
    shopAuthUnique: uniqueIndex("shop_staff_shop_auth_unique").on(
      table.shopId,
      table.authUserId
    ),
  })
);

// Staff çalışma saatleri
export const staffHours = pgTable(
  "staff_hours",
  {
    id: serial("id").primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => shopStaff.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0..6
    openTime: time("open_time").notNull(),
    closeTime: time("close_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    hoursUnique: uniqueIndex("staff_hours_unique").on(
      table.staffId,
      table.weekday,
      table.openTime,
      table.closeTime
    ),
  })
);

// Staff izin/leave kayıtları
export const staffLeaves = pgTable("staff_leaves", {
  id: serial("id").primaryKey(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => shopStaff.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  fullDay: boolean("full_day").default(true).notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  reason: text("reason"),
  tenantId: text("tenant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Kullanıcı favori berberleri - multi-tenant
export const userFavoriteBarbers = pgTable(
  "user_favorite_barbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auth mikroservisindeki user ID (müşteri)
    userAuthId: uuid("user_auth_id").notNull(),
    // shop_staff tablosundaki berber/staff ID
    staffId: uuid("staff_id")
      .notNull()
      .references(() => shopStaff.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Bir kullanıcı aynı berberi birden fazla kez favori olarak ekleyemesin
    userStaffUnique: uniqueIndex("user_favorite_barbers_user_staff_unique").on(
      table.tenantId,
      table.userAuthId,
      table.staffId
    ),
    // Kullanıcının favorilerini hızlı listelemek için indeks
    userFavoritesIdx: index("user_favorite_barbers_user_idx").on(
      table.tenantId,
      table.userAuthId
    ),
  })
);

// Kullanıcı favori dükkanları - multi-tenant
export const userFavoriteShops = pgTable(
  "user_favorite_shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auth mikroservisindeki user ID (müşteri)
    userAuthId: uuid("user_auth_id").notNull(),
    // barber_shops tablosundaki shop ID
    shopId: integer("shop_id")
      .notNull()
      .references(() => barberShops.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Bir kullanıcı aynı dükkanı birden fazla kez favori olarak ekleyemesin
    userShopUnique: uniqueIndex("user_favorite_shops_user_shop_unique").on(
      table.tenantId,
      table.userAuthId,
      table.shopId
    ),
    // Kullanıcının favori dükkanlarını hızlı listelemek için indeks
    userShopFavoritesIdx: index("user_favorite_shops_user_idx").on(
      table.tenantId,
      table.userAuthId
    ),
  })
);

// Bookings (randevular) - müşteri, berber ve kuaför ilişkisi
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").notNull(), // Auth servisinden gelen user ID
    // Berber/staff ID (genel randevu için nullable) - shop_staff'a referans
    barberId: uuid("barber_id").references(() => shopStaff.id, {
      onDelete: "set null",
    }),
    shopId: integer("shop_id")
      .notNull()
      .references(() => barberShops.id, { onDelete: "cascade" }), // integer olarak düzeltildi
    bookingDate: date("booking_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    // Zaman dilimi uyumlu alanlar (ISO 8601 - timestamptz). Geri uyumluluk için startTime/endTime alanları korunur.
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").default("pending").notNull(),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    // Multi-tenant ayrımı
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Sık kullanılan sorgular için kompozit indeksler
    // 1) Berber + Tarih + Başlangıç saati (multi-tenant ile birlikte)
    bookingsBarberDateStartIdx: index("bookings_barber_date_start_idx").on(
      table.tenantId,
      table.barberId,
      table.bookingDate,
      table.startTime
    ),
    // 2) Overlap kontrolü için aralık indeksleri (startTime + endTime)
    bookingsBarberDateRangeIdx: index("bookings_barber_date_range_idx").on(
      table.tenantId,
      table.barberId,
      table.bookingDate,
      table.startTime,
      table.endTime
    ),
  })
);

// Booking Services (randevu-hizmet ilişkisi) - çoklu hizmet seçimi için
export const bookingServices = pgTable(
  "booking_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bookingServiceUnique: uniqueIndex("booking_service_unique").on(
      table.bookingId,
      table.serviceId,
      table.tenantId
    ),
  })
);

// Logs tablosu - logger servisi için
export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    level: varchar("level", { length: 16 }).notNull(),
    service: varchar("service", { length: 64 }).notNull(),
    tenantId: text("tenant_id"),
    message: text("message").notNull(),
    context: text("context"),
    requestId: varchar("request_id", { length: 64 }),
    traceId: varchar("trace_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    serviceIdx: index("logs_service_idx").on(table.service),
    levelIdx: index("logs_level_idx").on(table.level),
    createdIdx: index("logs_created_idx").on(table.createdAt),
  })
);

// Notifications tablosu - notifications servisi için
export const notificationChannel = pgEnum("notification_channel", [
  "email",
  "sms",
  "push",
  "slack",
]);

export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "canceled",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull().default('main'),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    to: varchar("to", { length: 320 }).notNull(),
    channel: notificationChannel("channel").notNull(),
    provider: varchar("provider", { length: 64 }),
    templateId: varchar("template_id", { length: 128 }),
    subject: varchar("subject", { length: 320 }),
    payload: jsonb("payload"),
    status: notificationStatus("status").notNull().default('queued'),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    requestId: varchar("request_id", { length: 64 }),
    traceId: varchar("trace_id", { length: 64 }),
    correlationId: varchar("correlation_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("notifications_tenant_idx").on(table.tenantId),
    channelIdx: index("notifications_channel_idx").on(table.channel),
    statusIdx: index("notifications_status_idx").on(table.status),
    providerIdx: index("notifications_provider_idx").on(table.provider),
    createdIdx: index("notifications_created_idx").on(table.createdAt),
    toIdx: index("notifications_to_idx").on(table.to),
    correlationIdx: index("notifications_correlation_idx").on(table.correlationId),
  })
);

// In-app notifications tablosu
export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull().default('main'),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 320 }).notNull(),
    message: text("message").notNull(),
    type: varchar("type", { length: 32 }),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("in_app_notifications_tenant_idx").on(table.tenantId),
    userIdx: index("in_app_notifications_user_idx").on(table.userId),
    createdIdx: index("in_app_notifications_created_idx").on(table.createdAt),
    readIdx: index("in_app_notifications_read_idx").on(table.readAt),
  })
);

// ============================================================================
// TYPE EXPORTS - Otomatik tip üretimi
// ============================================================================

// Booking Types
export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;
export type BookingUpdate = Partial<Omit<NewBooking, "id" | "createdAt">>;

// User Types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Auth Types
export type Log = InferSelectModel<typeof logs>;
export type NewLog = InferInsertModel<typeof logs>;
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type InAppNotification = InferSelectModel<typeof inAppNotifications>;
export type NewInAppNotification = InferInsertModel<typeof inAppNotifications>;

// Barber Shop Types
export type BarberShop = InferSelectModel<typeof barberShops>;
export type NewBarberShop = InferInsertModel<typeof barberShops>;

// Service Types
export type Service = InferSelectModel<typeof services>;
export type NewService = InferInsertModel<typeof services>;

// Booking Service Types
export type BookingService = InferSelectModel<typeof bookingServices>;
export type NewBookingService = InferInsertModel<typeof bookingServices>;

// Enum Types
export type BookingStatusType = (typeof bookingStatus.enumValues)[number];
export type ShopGenderType = (typeof shopGender.enumValues)[number];
export type UserGenderType = (typeof userGender.enumValues)[number];
export type UserRoleType = (typeof userRole.enumValues)[number];
export type NotificationChannelType = (typeof notificationChannel.enumValues)[number];
export type NotificationStatusType = (typeof notificationStatus.enumValues)[number];

// Staff Types
export type ShopStaff = InferSelectModel<typeof shopStaff>;
export type NewShopStaff = InferInsertModel<typeof shopStaff>;
export type StaffHour = InferSelectModel<typeof staffHours>;
export type NewStaffHour = InferInsertModel<typeof staffHours>;
export type StaffLeave = InferSelectModel<typeof staffLeaves>;
export type NewStaffLeave = InferInsertModel<typeof staffLeaves>;
export type UserFavoriteBarber = InferSelectModel<typeof userFavoriteBarbers>;
export type NewUserFavoriteBarber = InferInsertModel<
  typeof userFavoriteBarbers
>;
export type UserFavoriteShop = InferSelectModel<typeof userFavoriteShops>;
export type NewUserFavoriteShop = InferInsertModel<typeof userFavoriteShops>;