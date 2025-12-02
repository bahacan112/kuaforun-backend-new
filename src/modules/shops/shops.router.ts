import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../../db";
import {
  barberShops,
  barberHours,
  shopStaff,
  userFavoriteBarbers,
  staffHours,
  staffLeaves,
  users,
  barberPhotos,
} from "../../db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
// import { and, sql } from 'drizzle-orm' // Commented out as not used
import { z } from "zod";
// Auth middleware kaldırıldı - services/auth mikroservisi kullanılıyor
// import { authMiddleware, requireRole } from '../../core/middleware/auth'
// import type { JwtPayload } from '../../core/security/jwt'
import type { Logger } from "../../core/logging/logger";
import type { AuthUser } from "../../core/clients/auth.client";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../core/middleware/auth.middleware";
import { resolveTenantId } from "../../shared/config/index";

import { AppError } from "../../core/errors";
import { SerpApiPlacesSearch } from "./serpapi.service";
import { S3StorageUploader } from "./storage.service";
import { ImportSerpApiDto, UploadGooglePhotoDto } from "./shops.dto";
import { ShopService } from "./shops.service";
import { ServicesService } from "../services/services.service";

export const shopsRouter = new Hono<{
  Variables: {
    logger: Logger;
    requestId: string;
    authUser?: AuthUser;
    userId?: string;
    userEmail?: string;
    userRole?: string;
  };
}>();

// Contentful status code helper to satisfy Hono's strict type definitions
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

const validGenders = ["male", "female", "unisex"] as const;
type ShopGender = (typeof validGenders)[number];
const isShopGender = (g: string): g is ShopGender =>
  validGenders.includes(g as ShopGender);

// Shared time format regex for HH:mm (00:00 - 23:59)
// Placed near the top to avoid "used before declaration" errors in schema definitions
const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// List all shops (public)
shopsRouter.get("/", async (c: Context) => {
  const gender = c.req.query("gender");
  const ownerOnly = c.req.query("ownerOnly");
  const ownerIdParam = c.req.query("ownerId");
  const name = c.req.query("name");
  const city = c.req.query("city");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = Math.max(0, (page - 1) * limit);
  const tenantId = resolveTenantId(c.req.header());
  const actorIdHeader = c.req.header("X-User-Id");
  const actorId = typeof actorIdHeader === "string" ? actorIdHeader : undefined;

  const ownerFilterActive = ownerOnly === "1" || ownerOnly === "true";
  const ownerId = ownerFilterActive
    ? ownerIdParam || actorId
    : ownerIdParam ?? undefined;

  const conditions = [eq(barberShops.tenantId, tenantId)];
  if (gender && isShopGender(gender)) {
    conditions.push(eq(barberShops.gender, gender));
  }
  if (
    ownerId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      ownerId
    )
  ) {
    conditions.push(eq(barberShops.ownerUserId, ownerId));
  }
  if (name) {
    conditions.push(sql`${barberShops.name} ILIKE ${"%" + name + "%"}`);
  }
  if (city) {
    conditions.push(
      sql`( ${barberShops.address} ILIKE ${"%" + city + "%"} OR ${
        barberShops.formattedAddress
      } ILIKE ${"%" + city + "%"} )`
    );
  }
  const whereClause =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  const list = await db
    .select()
    .from(barberShops)
    .where(whereClause)
    .orderBy(barberShops.createdAt)
    .limit(limit)
    .offset(offset);
  return c.json({
    data: list,
    pagination: { page, limit, count: list.length },
  });
});

// Get single shop by ID (public)
shopsRouter.get("/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid shop ID" }, 400);
  }

  const shop = await db
    .select()
    .from(barberShops)
    .where(eq(barberShops.id, id));

  if (shop.length === 0) {
    return c.json({ error: "Shop not found" }, 404);
  }

  return c.json({ data: shop[0] });
});

// Get shop working hours (public)
// Optional query: ?day=0..6 to fetch only specific weekday
shopsRouter.get("/:id/hours", async (c: Context) => {
  const id = c.req.param("id");
  const dayParam = c.req.query("day");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid shop ID format" }, 400);
  }
  const day = dayParam !== undefined ? Number(dayParam) : undefined;

  const minutesToHHmm = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const whereClause =
    day !== undefined && Number.isFinite(day)
      ? and(eq(barberHours.barberShopId, id), eq(barberHours.weekday, day))
      : eq(barberHours.barberShopId, id);

  const hours = await db.select().from(barberHours).where(whereClause);

  // Normalize for frontend consumption
  const normalized = hours.map((h) => ({
    id: h.id,
    weekday: h.weekday,
    openMinutes: h.openMinutes,
    closeMinutes: h.closeMinutes,
    open24h: Boolean(h.open24h),
    open: h.open24h ? "00:00" : minutesToHHmm(h.openMinutes ?? 0),
    close: h.open24h ? "23:59" : minutesToHHmm(h.closeMinutes ?? 0),
  }));

  // If a specific day requested and no record exists, optionally supply sensible default
  if (day !== undefined && normalized.length === 0) {
    const openDefault = 9 * 60;
    const closeDefault = 18 * 60;
    return c.json({
      data: [
        {
          weekday: day,
          openMinutes: openDefault,
          closeMinutes: closeDefault,
          open24h: false,
          open: minutesToHHmm(openDefault),
          close: minutesToHHmm(closeDefault),
        },
      ],
    });
  }

  return c.json({ data: normalized });
});

// -------------------------------
// Shop working hours CRUD (admin)
// -------------------------------
const ShopHoursCreateSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.string().regex(hhmmRegex, "open must be HH:mm").optional(),
  close: z.string().regex(hhmmRegex, "close must be HH:mm").optional(),
  openMinutes: z.number().int().min(0).max(1440).optional(),
  closeMinutes: z.number().int().min(0).max(1440).optional(),
  open24h: z.boolean().optional().default(false),
});

shopsRouter.post("/:id/hours", authMiddleware, async (c: Context) => {
  const shopId = c.req.param("id");
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  )
    return c.json({ error: "Invalid shop ID format" }, 400);
  const adminCheck = await ensureShopAdmin(c as AppContext, shopId);
  if ("error" in adminCheck)
    return c.json(
      { error: adminCheck.error },
      asAllowedStatus(adminCheck.status)
    );

  const body = await c.req.json().catch(() => ({}));
  const parsed = ShopHoursCreateSchema.safeParse(body);
  if (!parsed.success)
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      422
    );

  const minutesFromHHmm = (s: string) => {
    const [hh, mm] = s.split(":");
    const h = Number(hh);
    const m = Number(mm);
    return h * 60 + m;
  };

  const { weekday, open, close, openMinutes, closeMinutes, open24h } =
    parsed.data;
  let openM: number;
  let closeM: number;
  if (open24h) {
    openM = 0;
    closeM = 23 * 60 + 59;
  } else {
    const openCalc = openMinutes ?? (open ? minutesFromHHmm(open) : undefined);
    const closeCalc =
      closeMinutes ?? (close ? minutesFromHHmm(close) : undefined);
    if (openCalc === undefined || closeCalc === undefined)
      return c.json({ error: "open/close saatleri gerekli" }, 422);
    openM = openCalc;
    closeM = closeCalc;
  }

  if (
    Number.isNaN(openM) ||
    Number.isNaN(closeM) ||
    openM < 0 ||
    closeM < 0 ||
    openM >= 1440 ||
    closeM >= 1440
  )
    return c.json({ error: "Geçersiz saat aralığı" }, 422);
  if (!open24h && openM >= closeM)
    return c.json({ error: "open, close'dan küçük olmalı" }, 422);

  const [created] = await db
    .insert(barberHours)
    .values({
      barberShopId: shopId,
      weekday,
      openMinutes: openM,
      closeMinutes: closeM,
      open24h: open24h ?? false,
    })
    .returning();

  const minutesToHHmmCreate = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return c.json(
    {
      data: {
        id: created.id,
        weekday: created.weekday,
        openMinutes: created.openMinutes,
        closeMinutes: created.closeMinutes,
        open24h: Boolean(created.open24h),
        open: created.open24h
          ? "00:00"
          : minutesToHHmmCreate(created.openMinutes ?? 0),
        close: created.open24h
          ? "23:59"
          : minutesToHHmmCreate(created.closeMinutes ?? 0),
      },
    },
    201
  );
});

const ShopHoursUpdateSchema = z.object({
  weekday: z.number().int().min(0).max(6).optional(),
  open: z.string().regex(hhmmRegex, "open must be HH:mm").optional(),
  close: z.string().regex(hhmmRegex, "close must be HH:mm").optional(),
  openMinutes: z.number().int().min(0).max(1440).optional(),
  closeMinutes: z.number().int().min(0).max(1440).optional(),
  open24h: z.boolean().optional(),
});

shopsRouter.patch("/:id/hours/:hourId", authMiddleware, async (c: Context) => {
  const shopId = c.req.param("id");
  const hourId = c.req.param("hourId");
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  )
    return c.json({ error: "Invalid shop ID format" }, 400);
  if (
    !hourId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      hourId
    )
  )
    return c.json({ error: "Invalid hour ID format" }, 400);
  const adminCheck = await ensureShopAdmin(c as AppContext, shopId);
  if ("error" in adminCheck)
    return c.json(
      { error: adminCheck.error },
      asAllowedStatus(adminCheck.status)
    );

  const body = await c.req.json().catch(() => ({}));
  const parsed = ShopHoursUpdateSchema.safeParse(body);
  if (!parsed.success)
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      422
    );

  const existing = await db
    .select()
    .from(barberHours)
    .where(eq(barberHours.id, hourId))
    .limit(1);
  if (existing.length === 0) return c.json({ error: "Not found" }, 404);
  if (existing[0].barberShopId !== shopId)
    return c.json({ error: "Saat kaydı bu dükkana ait değil" }, 400);

  const minutesFromHHmmUpdate = (s: string) => {
    const [hh, mm] = s.split(":");
    const h = Number(hh);
    const m = Number(mm);
    return h * 60 + m;
  };

  const changes: Partial<typeof barberHours.$inferInsert> = {};
  if (parsed.data.weekday !== undefined) changes.weekday = parsed.data.weekday;
  if (parsed.data.open24h !== undefined) changes.open24h = parsed.data.open24h;
  const openCalc =
    parsed.data.openMinutes ??
    (parsed.data.open ? minutesFromHHmmUpdate(parsed.data.open) : undefined);
  const closeCalc =
    parsed.data.closeMinutes ??
    (parsed.data.close ? minutesFromHHmmUpdate(parsed.data.close) : undefined);
  if (openCalc !== undefined) changes.openMinutes = openCalc;
  if (closeCalc !== undefined) changes.closeMinutes = closeCalc;

  if (changes.open24h === false) {
    const openM = changes.openMinutes ?? existing[0].openMinutes;
    const closeM = changes.closeMinutes ?? existing[0].closeMinutes;
    if (openM >= closeM)
      return c.json({ error: "open, close'dan küçük olmalı" }, 422);
  }

  changes.updatedAt = new Date();

  const updated = await db
    .update(barberHours)
    .set(changes)
    .where(eq(barberHours.id, hourId))
    .returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);

  const minutesToHHmmUpdate = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const u = updated[0];
  return c.json({
    data: {
      id: u.id,
      weekday: u.weekday,
      openMinutes: u.openMinutes,
      closeMinutes: u.closeMinutes,
      open24h: Boolean(u.open24h),
      open: u.open24h ? "00:00" : minutesToHHmmUpdate(u.openMinutes ?? 0),
      close: u.open24h ? "23:59" : minutesToHHmmUpdate(u.closeMinutes ?? 0),
    },
  });
});

shopsRouter.delete("/:id/hours/:hourId", authMiddleware, async (c: Context) => {
  const shopId = c.req.param("id");
  const hourId = c.req.param("hourId");
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  )
    return c.json({ error: "Invalid shop ID format" }, 400);
  if (
    !hourId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      hourId
    )
  )
    return c.json({ error: "Invalid hour ID format" }, 400);
  const adminCheck = await ensureShopAdmin(c as AppContext, shopId);
  if ("error" in adminCheck)
    return c.json(
      { error: adminCheck.error },
      asAllowedStatus(adminCheck.status)
    );

  const existing = await db
    .select()
    .from(barberHours)
    .where(eq(barberHours.id, hourId))
    .limit(1);
  if (existing.length === 0) return c.json({ error: "Not found" }, 404);
  if (existing[0].barberShopId !== shopId)
    return c.json({ error: "Saat kaydı bu dükkana ait değil" }, 400);

  const deleted = await db
    .delete(barberHours)
    .where(eq(barberHours.id, hourId))
    .returning();
  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Belirli bir dükkanın staff listesini getir
// Opsiyonel auth: kullanıcı oturum açmışsa favori berberleri en üstte sıralanır
shopsRouter.get("/:id/staff", optionalAuthMiddleware, async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid shop ID" }, 400);
  }

  const tenantId = resolveTenantId(c.req.header());
  const actorIdHeader = c.req.header("X-User-Id");
  const userId = typeof actorIdHeader === "string" ? actorIdHeader : undefined;

  // Dükkanın staff'ını çek
  const staffRows = await db
    .select()
    .from(shopStaff)
    .where(and(eq(shopStaff.shopId, id), eq(shopStaff.tenantId, tenantId)));

  // Favori seti
  let favoriteSet: Set<string> = new Set();
  if (userId) {
    const favRows = await db
      .select()
      .from(userFavoriteBarbers)
      .where(
        and(
          eq(userFavoriteBarbers.tenantId, tenantId),
          eq(userFavoriteBarbers.userId, userId)
        )
      );
    favoriteSet = new Set(favRows.map((f) => f.staffId));
  }

  const enriched = staffRows.map((s) => ({
    ...s,
    isFavorite: favoriteSet.has(s.id),
  }));
  // Favoriler en üstte -> isFavorite desc, ardından role ve createdAt gibi ikincil sıralamalar uygulanabilir
  enriched.sort((a, b) => {
    const favDelta = Number(b.isFavorite) - Number(a.isFavorite);
    if (favDelta !== 0) return favDelta;
    // İkincil stabil sıralama: aktif olanlar önce
    if (a.isActive !== b.isActive)
      return Number(b.isActive) - Number(a.isActive);
    return 0;
  });

  return c.json({ data: enriched });
});

// ----------------------------------------------------------------------------
// Staff CRUD Endpoints (create/read/update/delete)
// ----------------------------------------------------------------------------

const validStaffRoles = [
  "owner",
  "manager",
  "barber",
  "assistant",
  "reception",
] as const;
const isValidStaffRole = (r: string): r is (typeof validStaffRoles)[number] =>
  validStaffRoles.includes(r as (typeof validStaffRoles)[number]);

// Admin helper roles (owner and manager are considered admins)
const ADMIN_ROLES = new Set(["owner", "manager"]);
const isAdminRole = (r: string): boolean => ADMIN_ROLES.has(r);

const StaffCreateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(validStaffRoles).optional().default("barber"),
  isActive: z.boolean().optional().default(true),
});

const StaffUpdateSchema = z.object({
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET single staff by ID
shopsRouter.get("/:id/staff/:staffId", async (c: Context) => {
  const id = c.req.param("id");
  const staffId = c.req.param("staffId");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return c.json({ error: "Invalid shop ID" }, 400);
  if (
    !staffId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      staffId
    )
  )
    return c.json({ error: "Invalid staff ID" }, 400);
  const tenantId = resolveTenantId(c.req.header());
  const rows = await db
    .select()
    .from(shopStaff)
    .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return c.json({ error: "Staff not found" }, 404);
  if (rows[0].shopId !== id)
    return c.json({ error: "Staff does not belong to the shop" }, 400);
  return c.json({ data: rows[0] });
});

// CREATE staff for a shop
shopsRouter.post("/:id/staff", authMiddleware, async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return c.json({ error: "Invalid shop ID" }, 400);
  const tenantId = resolveTenantId(c.req.header());
  const body = await c.req.json().catch(() => ({}));
  const parsed = StaffCreateSchema.safeParse(body);
  if (!parsed.success)
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      422
    );
  const { userId, role, isActive } = parsed.data;
  const normalizedRole = role ?? "barber";

  // First-admin bootstrap logic: if the shop has NO admins yet, allow the
  // current authenticated user to assign THEMSELVES as owner/manager.
  // Otherwise, require standard admin check (ensureShopAdmin).
  const currentUserId = (c as unknown as { get: (k: string) => unknown }).get(
    "userId"
  ) as string | undefined;
  if (!currentUserId) return c.json({ error: "Authorization required" }, 401);

  const existingAdmins = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, id),
        eq(shopStaff.tenantId, tenantId),
        inArray(shopStaff.role, ["owner", "manager"])
      )
    )
    .limit(1);

  if (existingAdmins.length > 0) {
    // Normal path: only an admin (owner/manager) can add staff
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
  } else {
    // Bootstrap path: no admins exist yet
    if (userId !== currentUserId)
      return c.json(
        {
          error:
            "İlk admin ataması yalnızca kendinizi owner/manager olarak atayabilirsiniz",
        },
        403
      );
    if (!isAdminRole(normalizedRole))
      return c.json(
        {
          error: "İlk admin ataması için rol 'owner' veya 'manager' olmalıdır",
        },
        403
      );
  }

  // users tablosunda var mı kontrol et (tenant eşleşmesi)
  const userRows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);
  if (userRows.length === 0)
    return c.json({ error: "Kullanıcı bulunamadı" }, 404);

  // Aynı kullanıcı aynı dükkanda zaten staff mı?
  const existing = await db
    .select()
    .from(shopStaff)
    .where(and(eq(shopStaff.shopId, id), eq(shopStaff.userId, userId)))
    .limit(1);
  if (existing.length > 0)
    return c.json({ error: "Bu kullanıcı zaten bu dükkanda personel" }, 409);

  const [created] = await db
    .insert(shopStaff)
    .values({
      shopId: id,
      userId,
      role: normalizedRole,
      isActive: isActive ?? true,
      tenantId,
    })
    .returning();
  return c.json({ data: created }, 201);
});

// UPDATE staff
shopsRouter.patch("/:id/staff/:staffId", authMiddleware, async (c: Context) => {
  const id = c.req.param("id");
  const staffId = c.req.param("staffId");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return c.json({ error: "Invalid shop ID" }, 400);
  if (
    !staffId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      staffId
    )
  )
    return c.json({ error: "Invalid staff ID" }, 400);
  const adminCheck = await ensureShopAdmin(c as AppContext, id);
  if ("error" in adminCheck)
    return c.json(
      { error: adminCheck.error },
      asAllowedStatus(adminCheck.status)
    );
  const tenantId = resolveTenantId(c.req.header());
  const body = await c.req.json().catch(() => ({}));
  const parsed = StaffUpdateSchema.safeParse(body);
  if (!parsed.success)
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      422
    );

  // Staff doğrula ve shop eşleşmesi
  const rows = await db
    .select()
    .from(shopStaff)
    .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0) return c.json({ error: "Staff not found" }, 404);
  if (rows[0].shopId !== id)
    return c.json({ error: "Staff does not belong to the shop" }, 400);

  const changes: Partial<typeof shopStaff.$inferInsert> = {};
  if (parsed.data.role !== undefined) {
    if (!isValidStaffRole(parsed.data.role)) {
      return c.json({ error: "Geçersiz rol" }, 422);
    }
    // Type is narrowed by isValidStaffRole type-guard; assign directly without using 'any'
    changes.role = parsed.data.role;
  }
  if (parsed.data.isActive !== undefined)
    changes.isActive = parsed.data.isActive;
  changes.updatedAt = new Date();

  const updated = await db
    .update(shopStaff)
    .set(changes)
    .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
    .returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ data: updated[0] });
});

// DELETE staff
shopsRouter.delete(
  "/:id/staff/:staffId",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    const staffId = c.req.param("staffId");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    if (
      !staffId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        staffId
      )
    )
      return c.json({ error: "Invalid staff ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const tenantId = resolveTenantId(c.req.header());

    // Staff doğrula ve shop eşleşmesi
    const rows = await db
      .select()
      .from(shopStaff)
      .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
      .limit(1);
    if (rows.length === 0) return c.json({ error: "Staff not found" }, 404);
    if (rows[0].shopId !== id)
      return c.json({ error: "Staff does not belong to the shop" }, 400);

    const deleted = await db
      .delete(shopStaff)
      .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
      .returning();
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  }
);

// ----------------------------------------------------------------------------
// Staff Availability Endpoints (hours & leaves)
// ----------------------------------------------------------------------------

const toTime = (s: string) => (s.length === 5 ? `${s}:00` : s);

const StaffHoursCreateSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  openTime: z.string().regex(hhmmRegex, "openTime must be HH:mm"),
  closeTime: z.string().regex(hhmmRegex, "closeTime must be HH:mm"),
  isActive: z.boolean().optional().default(true),
});

const StaffHoursUpdateSchema = z.object({
  weekday: z.number().int().min(0).max(6).optional(),
  openTime: z.string().regex(hhmmRegex, "openTime must be HH:mm").optional(),
  closeTime: z.string().regex(hhmmRegex, "closeTime must be HH:mm").optional(),
  isActive: z.boolean().optional(),
});

const StaffLeaveCreateSchema = z.object({
  startDate: z.string().min(10), // YYYY-MM-DD
  endDate: z.string().min(10),
  fullDay: z.boolean().optional().default(true),
  startTime: z.string().regex(hhmmRegex).optional(),
  endTime: z.string().regex(hhmmRegex).optional(),
  reason: z.string().max(500).optional(),
});

const StaffLeaveUpdateSchema = z.object({
  startDate: z.string().min(10).optional(),
  endDate: z.string().min(10).optional(),
  fullDay: z.boolean().optional(),
  startTime: z.string().regex(hhmmRegex).optional(),
  endTime: z.string().regex(hhmmRegex).optional(),
  reason: z.string().max(500).optional(),
});

// Helper: ensure staff belongs to shop and is in tenant
// Narrow context type usage in helpers to avoid generics mismatch with Hono app
type AppContext = Context<{
  Variables: {
    logger: Logger;
    requestId: string;
    authUser?: AuthUser;
    userId?: string;
    userEmail?: string;
    userRole?: string;
  };
}>;
// Narrowing helpers for TypeScript unions
type StaffEnsureError = { error: string; status: AllowedStatus };
function isEnsureError(res: unknown): res is StaffEnsureError {
  if (!res || typeof res !== "object") return false;
  const r = res as { error?: unknown; status?: unknown };
  return typeof r.error === "string" && typeof r.status === "number";
}
async function ensureStaff(c: Context, shopId: string) {
  const tenantId = resolveTenantId(c.req.header());
  const staffId = c.req.param("staffId");
  const rows = await db
    .select()
    .from(shopStaff)
    .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
    .limit(1);
  if (rows.length === 0)
    return { error: "Staff not found", status: 404 } as const;
  if (rows[0].shopId !== shopId)
    return { error: "Staff does not belong to the shop", status: 400 } as const;
  return { tenantId, staff: rows[0] } as const;
}

// RBAC: ensure the current auth user is an admin of the given shop (owner or manager)
type AdminCheckResult =
  | { tenantId: string; adminStaff: typeof shopStaff.$inferSelect }
  | { error: string; status: number };
async function ensureShopAdmin(
  c: Context,
  shopId: string
): Promise<AdminCheckResult> {
  const tenantId = resolveTenantId(c.req.header());
  const userIdCtx = (c as unknown as { get: (k: string) => unknown }).get(
    "userId"
  ) as string | undefined;
  if (!userIdCtx) {
    return { error: "Authorization required", status: 401 } as const;
  }
  const rows = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userIdCtx),
        eq(shopStaff.tenantId, tenantId)
      )
    )
    .limit(1);
  if (rows.length === 0) {
    const userRows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userIdCtx), eq(users.tenantId, tenantId)))
      .limit(1);
    if (userRows.length > 0 && String(userRows[0].role) === "admin") {
      const adminStaff = {
        id: "00000000-0000-0000-0000-000000000000",
        shopId,
        userId: userIdCtx,
        role: "manager",
        isActive: true,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as typeof shopStaff.$inferSelect;
      return { tenantId, adminStaff } as const;
    }
    return { error: "Forbidden", status: 403 } as const;
  }
  const role = rows[0].role as string;
  if (!isAdminRole(role)) {
    return { error: "Forbidden", status: 403 } as const;
  }
  return { tenantId, adminStaff: rows[0] } as const;
}

// GET staff hours
shopsRouter.get("/:id/staff/:staffId/hours", async (c: Context) => {
  const id = c.req.param("id");
  const weekdayParam = c.req.query("weekday");
  const weekday = weekdayParam !== undefined ? Number(weekdayParam) : undefined;
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return c.json({ error: "Invalid shop ID" }, 400);
  const ensured = await ensureStaff(c, id);
  if (isEnsureError(ensured))
    return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
  const whereBase = and(
    eq(staffHours.staffId, ensured.staff.id),
    eq(staffHours.tenantId, ensured.tenantId)
  );
  const where =
    weekday !== undefined && Number.isFinite(weekday)
      ? and(whereBase, eq(staffHours.weekday, weekday))
      : whereBase;
  const rows = await db.select().from(staffHours).where(where);
  return c.json({ data: rows });
});

// POST staff hours
shopsRouter.post(
  "/:id/staff/:staffId/hours",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const ensured = await ensureStaff(c, id);
    if (isEnsureError(ensured))
      return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
    const body = await c.req.json().catch(() => ({}));
    const parsed = StaffHoursCreateSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        422
      );
    const payload = parsed.data;
    const [created] = await db
      .insert(staffHours)
      .values({
        staffId: ensured.staff.id,
        weekday: payload.weekday,
        openTime: toTime(payload.openTime),
        closeTime: toTime(payload.closeTime),
        isActive: payload.isActive ?? true,
        tenantId: ensured.tenantId,
      })
      .returning();
    return c.json({ data: created }, 201);
  }
);

// PATCH staff hours
shopsRouter.patch(
  "/:id/staff/:staffId/hours/:hourId",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    const hourId = c.req.param("hourId");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    if (
      !hourId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        hourId
      )
    )
      return c.json({ error: "Invalid hour ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const ensured = await ensureStaff(c, id);
    if (isEnsureError(ensured))
      return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
    const body = await c.req.json().catch(() => ({}));
    const parsed = StaffHoursUpdateSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        422
      );
    const changes: Partial<typeof staffHours.$inferInsert> = {};
    if (parsed.data.weekday !== undefined)
      changes.weekday = parsed.data.weekday;
    if (parsed.data.openTime !== undefined)
      changes.openTime = toTime(parsed.data.openTime);
    if (parsed.data.closeTime !== undefined)
      changes.closeTime = toTime(parsed.data.closeTime);
    if (parsed.data.isActive !== undefined)
      changes.isActive = parsed.data.isActive;
    changes.updatedAt = new Date();
    const updated = await db
      .update(staffHours)
      .set(changes)
      .where(
        and(
          eq(staffHours.id, hourId),
          eq(staffHours.staffId, ensured.staff.id),
          eq(staffHours.tenantId, ensured.tenantId)
        )
      )
      .returning();
    if (updated.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ data: updated[0] });
  }
);

// DELETE staff hours
shopsRouter.delete(
  "/:id/staff/:staffId/hours/:hourId",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    const hourId = c.req.param("hourId");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    if (
      !hourId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        hourId
      )
    )
      return c.json({ error: "Invalid hour ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const ensured = await ensureStaff(c, id);
    if (isEnsureError(ensured))
      return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
    const deleted = await db
      .delete(staffHours)
      .where(
        and(
          eq(staffHours.id, hourId),
          eq(staffHours.staffId, ensured.staff.id),
          eq(staffHours.tenantId, ensured.tenantId)
        )
      )
      .returning();
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  }
);

// GET staff leaves (optional filters: startDate/endDate)
shopsRouter.get("/:id/staff/:staffId/leaves", async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return c.json({ error: "Invalid shop ID" }, 400);
  const ensured = await ensureStaff(c, id);
  if (isEnsureError(ensured))
    return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
  const rows = await db
    .select()
    .from(staffLeaves)
    .where(
      and(
        eq(staffLeaves.staffId, ensured.staff.id),
        eq(staffLeaves.tenantId, ensured.tenantId)
      )
    );
  return c.json({ data: rows });
});

// POST staff leave
shopsRouter.post(
  "/:id/staff/:staffId/leaves",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const ensured = await ensureStaff(c, id);
    if (isEnsureError(ensured))
      return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
    const body = await c.req.json().catch(() => ({}));
    const parsed = StaffLeaveCreateSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        422
      );
    const payload = parsed.data;
    // Validation: if not fullDay, require startTime/endTime
    if (!payload.fullDay && (!payload.startTime || !payload.endTime)) {
      return c.json(
        { error: "Saatlik izin için startTime ve endTime gerekli" },
        422
      );
    }
    const [created] = await db
      .insert(staffLeaves)
      .values({
        staffId: ensured.staff.id,
        startDate: payload.startDate,
        endDate: payload.endDate,
        fullDay: payload.fullDay ?? true,
        startTime: payload.startTime ? toTime(payload.startTime) : null,
        endTime: payload.endTime ? toTime(payload.endTime) : null,
        reason: payload.reason ?? null,
        tenantId: ensured.tenantId,
      })
      .returning();
    return c.json({ data: created }, 201);
  }
);

// PATCH staff leave
shopsRouter.patch(
  "/:id/staff/:staffId/leaves/:leaveId",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    const leaveId = c.req.param("leaveId");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    if (
      !leaveId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        leaveId
      )
    )
      return c.json({ error: "Invalid leave ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const ensured = await ensureStaff(c, id);
    if (isEnsureError(ensured))
      return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
    const body = await c.req.json().catch(() => ({}));
    const parsed = StaffLeaveUpdateSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        422
      );
    const changes: Partial<typeof staffLeaves.$inferInsert> = {};
    if (parsed.data.startDate !== undefined)
      changes.startDate = parsed.data.startDate;
    if (parsed.data.endDate !== undefined)
      changes.endDate = parsed.data.endDate;
    if (parsed.data.fullDay !== undefined)
      changes.fullDay = parsed.data.fullDay;
    if (parsed.data.startTime !== undefined)
      changes.startTime = parsed.data.startTime
        ? toTime(parsed.data.startTime)
        : null;
    if (parsed.data.endTime !== undefined)
      changes.endTime = parsed.data.endTime
        ? toTime(parsed.data.endTime)
        : null;
    if (parsed.data.reason !== undefined)
      changes.reason = parsed.data.reason ?? null;
    changes.updatedAt = new Date();
    const updated = await db
      .update(staffLeaves)
      .set(changes)
      .where(
        and(
          eq(staffLeaves.id, leaveId),
          eq(staffLeaves.staffId, ensured.staff.id),
          eq(staffLeaves.tenantId, ensured.tenantId)
        )
      )
      .returning();
    if (updated.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ data: updated[0] });
  }
);

// DELETE staff leave
shopsRouter.delete(
  "/:id/staff/:staffId/leaves/:leaveId",
  authMiddleware,
  async (c: Context) => {
    const id = c.req.param("id");
    const leaveId = c.req.param("leaveId");
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      return c.json({ error: "Invalid shop ID" }, 400);
    if (
      !leaveId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        leaveId
      )
    )
      return c.json({ error: "Invalid leave ID" }, 400);
    const adminCheck = await ensureShopAdmin(c as AppContext, id);
    if ("error" in adminCheck)
      return c.json(
        { error: adminCheck.error },
        asAllowedStatus(adminCheck.status)
      );
    const ensured = await ensureStaff(c, id);
    if (isEnsureError(ensured))
      return c.json({ error: ensured.error }, asAllowedStatus(ensured.status));
    const deleted = await db
      .delete(staffLeaves)
      .where(
        and(
          eq(staffLeaves.id, leaveId),
          eq(staffLeaves.staffId, ensured.staff.id),
          eq(staffLeaves.tenantId, ensured.tenantId)
        )
      )
      .returning();
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  }
);

// Create shop (admin or supervisor)
const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(3),
  gender: z.enum(["male", "female", "unisex"]).optional(),
  ownerUserId: z.string().uuid().optional(),
});

// Create shop - auth middleware kaldırıldı, artık gateway seviyesinde kontrol edilecek
shopsRouter.post("/", async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const body = await c.req.json().catch(() => ({}));
  const parse = createSchema.safeParse(body);
  if (!parse.success)
    return c.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      400
    );

  // Try to resolve ownerUserId from header if not provided
  const actorIdHeader = c.req.header("X-User-Id");
  const actorId = typeof actorIdHeader === "string" ? actorIdHeader : undefined;
  const ownerUserId =
    parse.data.ownerUserId ??
    (actorId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      actorId
    )
      ? actorId
      : undefined);

  const created = await db
    .insert(barberShops)
    .values({
      name: parse.data.name,
      address: parse.data.address,
      phone: parse.data.phone,
      tenantId: tenantId,
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(parse.data.gender ? { gender: parse.data.gender } : {}),
    })
    .returning();

  const shop = created[0];
  // Auto-apply default services when a new shop is created
  try {
    const svc = new ServicesService();
    await svc.addDefaultServicesToShop(shop.id);
  } catch {}

  return c.json({ data: shop });
});

// Update shop (partial) (admin or supervisor)
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
  // ownerUserId: z.string().uuid().nullable().optional(), // Auth services entegrasyonu bekliyor
  gender: z.enum(["male", "female", "unisex"]).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

// Update shop - auth middleware kaldırıldı, artık gateway seviyesinde kontrol edilecek
shopsRouter.patch("/:id", async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parse = updateSchema.safeParse(body);
  if (!parse.success)
    return c.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      400
    );

  const changes: Partial<typeof barberShops.$inferInsert> = {};
  if (parse.data.name !== undefined) changes.name = parse.data.name;
  if (parse.data.address !== undefined) changes.address = parse.data.address;
  if (parse.data.phone !== undefined) changes.phone = parse.data.phone;
  // if (Object.prototype.hasOwnProperty.call(parse.data, 'ownerUserId')) changes.ownerUserId = parse.data.ownerUserId ?? null // Auth services entegrasyonu bekliyor
  if (parse.data.gender !== undefined) changes.gender = parse.data.gender;
  if (parse.data.email !== undefined) changes.email = parse.data.email;
  if (parse.data.website !== undefined) changes.website = parse.data.website;
  changes.updatedAt = new Date();

  const updated = await db
    .update(barberShops)
    .set(changes)
    .where(eq(barberShops.id, id))
    .returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ data: updated[0] });
});

// Delete shop (admin or supervisor)
// Delete shop - auth middleware kaldırıldı, artık gateway seviyesinde kontrol edilecek
shopsRouter.delete("/:id", async (c: Context) => {
  const id = c.req.param("id");
  const deleted = await db
    .delete(barberShops)
    .where(eq(barberShops.id, id))
    .returning();
  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Super-admin: Assign owner user to a shop
shopsRouter.post("/:id/owner", authMiddleware, async (c: Context) => {
  const id = c.req.param("id");
  const role = (c.get("userRole") as string | undefined) || "";
  if (role !== "admin") {
    return c.json({ error: "Only super-admin can assign owner" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : undefined;
  const actorHeader = c.req.header("X-User-Id");
  const actorId = typeof actorHeader === "string" ? actorHeader : undefined;
  const targetUser = userId ?? actorId;
  if (
    !targetUser ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      targetUser
    )
  ) {
    return c.json({ error: "Invalid or missing userId" }, 400);
  }
  const updated = await db
    .update(barberShops)
    .set({ ownerUserId: targetUser, updatedAt: new Date() })
    .where(eq(barberShops.id, id))
    .returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ data: updated[0] });
});

// Admin: SerpAPI'den koordinatlara göre berberleri içeri aktar

shopsRouter.post("/import-serpapi", async (c: Context) => {
  const logger = c.get("logger");
  const parse = ImportSerpApiDto.safeParse(await c.req.json());
  if (!parse.success)
    throw new AppError(
      "Invalid payload",
      422,
      "VALIDATION_ERROR",
      parse.error.flatten()
    );
  const dto = parse.data;

  logger?.info({ dto }, "serpapi-import-start");
  const service = new ShopService(
    new SerpApiPlacesSearch(),
    new S3StorageUploader()
  );
  const result = await service.importSerpApi(dto);
  logger?.info({ result }, "serpapi-import-finish");
  return c.json(result, 200);
});

// Admin: Google photo_reference ile fotoğrafı indir, iDrive E2 S3'e yükle ve barber_photos'a ekle

shopsRouter.post("/:id/photos/upload-google", async (c: Context) => {
  const shopId = c.req.param("id");
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  )
    throw new AppError("Invalid shop id", 400, "BAD_REQUEST");

  const logger = c.get("logger");
  const parse = UploadGooglePhotoDto.safeParse(await c.req.json());
  if (!parse.success)
    throw new AppError(
      "Invalid payload",
      422,
      "VALIDATION_ERROR",
      parse.error.flatten()
    );
  const dto = parse.data;

  logger?.info({ shopId, dto }, "google-photo-upload-start");
  const service = new ShopService(
    new SerpApiPlacesSearch(),
    new S3StorageUploader()
  );
  const result = await service.uploadGooglePhoto(shopId, dto);
  logger?.info({ shopId, result }, "google-photo-upload-finish");
  return c.json(result, 200);
});

// Photos: list for a shop
shopsRouter.get(":id/photos", async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid shop ID" }, 400);
  }
  const rows = await db
    .select()
    .from(barberPhotos)
    .where(eq(barberPhotos.barberShopId, id));
  return c.json({ data: rows });
});

// Photos: create/link a photo uploaded via S3 presigned URL
shopsRouter.post(":id/photos", async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid shop ID" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const objectKey = String(body.objectKey || "").trim();
  const originalName =
    typeof body.originalName === "string" ? body.originalName : undefined;
  const contentType =
    typeof body.contentType === "string" ? body.contentType : undefined;
  const width = typeof body.width === "number" ? body.width : undefined;
  const height = typeof body.height === "number" ? body.height : undefined;
  if (!objectKey) return c.json({ error: "objectKey gerekli" }, 400);
  const base = process.env.S3_PUBLIC_BASE_URL;
  const bucket = process.env.S3_BUCKET;
  let publicUrl: string | null = null;
  if (base && bucket) {
    try {
      const u = new URL(base);
      u.pathname = [u.pathname.replace(/\/$/, ""), bucket, objectKey]
        .filter(Boolean)
        .join("/");
      publicUrl = u.toString();
    } catch {
      publicUrl = null;
    }
  }
  const ref = originalName || objectKey.split("/").pop() || objectKey;
  const inserted = await db
    .insert(barberPhotos)
    .values({
      barberShopId: id,
      photoReference: ref,
      width: width,
      height: height,
      attributions: contentType ? { contentType } : undefined,
      storageKey: objectKey,
      storageUrl: publicUrl ?? undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return c.json({ data: inserted[0] }, 201);
});

// Photos: update metadata
shopsRouter.patch(":id/photos/:photoId", async (c: Context) => {
  const id = c.req.param("id");
  const photoId = c.req.param("photoId");
  if (
    !id ||
    !photoId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      photoId
    )
  ) {
    return c.json({ error: "Invalid ID format" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const photoReference =
    typeof body.photoReference === "string" ? body.photoReference : undefined;
  const width = typeof body.width === "number" ? body.width : undefined;
  const height = typeof body.height === "number" ? body.height : undefined;
  const changes: Partial<typeof barberPhotos.$inferInsert> = {};
  if (photoReference !== undefined) changes.photoReference = photoReference;
  if (width !== undefined) changes.width = width;
  if (height !== undefined) changes.height = height;
  changes.updatedAt = new Date();
  const updated = await db
    .update(barberPhotos)
    .set(changes)
    .where(and(eq(barberPhotos.id, photoId), eq(barberPhotos.barberShopId, id)))
    .returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ data: updated[0] });
});

// Photos: delete
shopsRouter.delete(":id/photos/:photoId", async (c: Context) => {
  const id = c.req.param("id");
  const photoId = c.req.param("photoId");
  if (
    !id ||
    !photoId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      photoId
    )
  ) {
    return c.json({ error: "Invalid ID format" }, 400);
  }
  await db
    .delete(barberPhotos)
    .where(
      and(eq(barberPhotos.id, photoId), eq(barberPhotos.barberShopId, id))
    );
  return c.json({ ok: true });
});
