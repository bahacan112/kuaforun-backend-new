import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../../db";
import { and, eq } from "drizzle-orm";
import { resolveTenantId } from "@shared/config";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import {
  users,
  userFavoriteBarbers,
  userFavoriteShops,
  shopStaff,
  barberShops,
} from "../../db/schema";

// Favori berberler için router
export const favoritesRouter = new Hono();

// Bir berberi favorilere ekle
favoritesRouter.post("/barbers/:staffId", authMiddleware, async (c: Context) => {
  const staffId = c.req.param("staffId");
  const tenantId = resolveTenantId(c.req.header());
  const rawId = (c as unknown as { get: (k: string) => unknown }).get("userId");
  const actorRoleHeader = (c as unknown as { get: (k: string) => unknown }).get("userRole") as string | undefined;
  const backendId = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : undefined;
  const mapRows = backendId
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.id, backendId), eq(users.tenantId, tenantId))).limit(1)
    : [];
  const userId = mapRows[0]?.id;

  if (!userId) {
    return c.json({ data: [] });
  }
  if (actorRoleHeader !== "customer") {
    return c.json({ error: "Sadece müşteriler favori ekleyebilir" }, 403);
  }
  if (!staffId) {
    return c.json({ error: "Geçersiz staffId" }, 400);
  }

  // Staff doğrulama (tenant & aktif)
  const staffRows = await db
    .select()
    .from(shopStaff)
    .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
    .limit(1);
  if (staffRows.length === 0) {
    return c.json({ error: "Berber/staff bulunamadı" }, 404);
  }

  // Mevcut favori var mı?
  const existing = await db
    .select()
    .from(userFavoriteBarbers)
    .where(
      and(
        eq(userFavoriteBarbers.tenantId, tenantId),
        eq(userFavoriteBarbers.userId, userId),
        eq(userFavoriteBarbers.staffId, staffId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return c.json({ ok: true, data: existing[0] });
  }

  const inserted = await db
    .insert(userFavoriteBarbers)
    .values({ tenantId, userId, staffId })
    .returning();

  return c.json({ ok: true, data: inserted[0] });
});

// Bir berberi favorilerden kaldır
favoritesRouter.delete("/barbers/:staffId", authMiddleware, async (c: Context) => {
  const staffId = c.req.param("staffId");
  const tenantId = resolveTenantId(c.req.header());
  const rawId = (c as unknown as { get: (k: string) => unknown }).get("userId");
  const actorRoleHeader = (c as unknown as { get: (k: string) => unknown }).get("userRole") as string | undefined;
  const backendId = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : undefined;
  const mapRows = backendId
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.id, backendId), eq(users.tenantId, tenantId))).limit(1)
    : [];
  const userId = mapRows[0]?.id;

  if (!userId) {
    return c.json({ data: [] });
  }
  if (actorRoleHeader !== "customer") {
    return c.json({ error: "Sadece müşteriler favori kaldırabilir" }, 403);
  }
  if (!staffId) {
    return c.json({ error: "Geçersiz staffId" }, 400);
  }

  const deleted = await db
    .delete(userFavoriteBarbers)
    .where(
      and(
        eq(userFavoriteBarbers.tenantId, tenantId),
        eq(userFavoriteBarbers.userId, userId),
        eq(userFavoriteBarbers.staffId, staffId)
      )
    )
    .returning();

  return c.json({ ok: true, deletedCount: deleted.length });
});

// Kullanıcının favori berberlerini listele (opsiyonel shopId filtresi)
favoritesRouter.get("/barbers", authMiddleware, async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const rawId = (c as unknown as { get: (k: string) => unknown }).get("userId");
  const actorRoleHeader = (c as unknown as { get: (k: string) => unknown }).get("userRole") as string | undefined;
  const backendId = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : undefined;
  const mapRows = backendId
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.id, backendId), eq(users.tenantId, tenantId))).limit(1)
    : [];
  const userId = mapRows[0]?.id;
  const shopIdParam = c.req.query("shopId");
  const shopId = shopIdParam || undefined;

  if (!userId) {
    return c.json({ data: [] });
  }
  if (actorRoleHeader !== "customer") {
    return c.json(
      { error: "Sadece müşteriler favorilerini listeleyebilir" },
      403
    );
  }

  // Favoriler + staff bilgisi
  const favorites = await db
    .select({
      id: userFavoriteBarbers.id,
      staffId: userFavoriteBarbers.staffId,
      userId: userFavoriteBarbers.userId,
      shopId: shopStaff.shopId,
      role: shopStaff.role,
      isActive: shopStaff.isActive,
      createdAt: userFavoriteBarbers.createdAt,
    })
    .from(userFavoriteBarbers)
    .innerJoin(
      shopStaff,
      and(
        eq(shopStaff.id, userFavoriteBarbers.staffId),
        eq(shopStaff.tenantId, userFavoriteBarbers.tenantId)
      )
    )
    .where(
      and(
        eq(userFavoriteBarbers.tenantId, tenantId),
        eq(userFavoriteBarbers.userId, userId),
        ...(shopId !== undefined ? [eq(shopStaff.shopId, shopId)] : [])
      )
    );

  return c.json({ data: favorites });
});

// Bir dükkanı favorilere ekle
favoritesRouter.post("/shops/:shopId", authMiddleware, async (c: Context) => {
  const shopIdParam = c.req.param("shopId");
  const shopId = shopIdParam;
  const tenantId = resolveTenantId(c.req.header());

  const rawId = (c as unknown as { get: (k: string) => unknown }).get("userId");
  const actorRoleHeader = (c as unknown as { get: (k: string) => unknown }).get("userRole") as string | undefined;
  const backendId = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : undefined;
  const mapRows = backendId
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.id, backendId), eq(users.tenantId, tenantId))).limit(1)
    : [];
  const userId = mapRows[0]?.id;

  if (!userId) {
    return c.json({ error: "Kimlik doğrulama gerekli" }, 401);
  }
  if (actorRoleHeader !== "customer") {
    return c.json({ error: "Sadece müşteriler favori ekleyebilir" }, 403);
  }
  if (!shopId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId)) {
    return c.json({ error: "Geçersiz shopId formatı" }, 400);
  }

  // Shop doğrulama
  const shopRows = await db
    .select()
    .from(barberShops)
    .where(eq(barberShops.id, shopId))
    .limit(1);
  if (shopRows.length === 0) {
    return c.json({ error: "Dükkan bulunamadı" }, 404);
  }

  // Mevcut favori var mı?
  const existing = await db
    .select()
    .from(userFavoriteShops)
    .where(
      and(
        eq(userFavoriteShops.tenantId, tenantId),
        eq(userFavoriteShops.userId, userId),
        eq(userFavoriteShops.shopId, shopId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return c.json({ ok: true, data: existing[0] });
  }

  const inserted = await db
    .insert(userFavoriteShops)
    .values({ tenantId, userId, shopId })
    .returning();

  return c.json({ ok: true, data: inserted[0] });
});

// Bir dükkanı favorilerden kaldır
favoritesRouter.delete("/shops/:shopId", authMiddleware, async (c: Context) => {
  const shopIdParam = c.req.param("shopId");
  const shopId = shopIdParam;
  const tenantId = resolveTenantId(c.req.header());
  const rawId = (c as unknown as { get: (k: string) => unknown }).get("userId");
  const actorRoleHeader = (c as unknown as { get: (k: string) => unknown }).get("userRole") as string | undefined;
  const backendId = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : undefined;
  const mapRows = backendId
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.id, backendId), eq(users.tenantId, tenantId))).limit(1)
    : [];
  const userId = mapRows[0]?.id;

  if (!userId) {
    return c.json({ error: "Kimlik doğrulama gerekli" }, 401);
  }
  if (actorRoleHeader !== "customer") {
    return c.json({ error: "Sadece müşteriler favori kaldırabilir" }, 403);
  }
  if (!shopId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId)) {
    return c.json({ error: "Geçersiz shopId formatı" }, 400);
  }

  const deleted = await db
    .delete(userFavoriteShops)
    .where(
      and(
        eq(userFavoriteShops.tenantId, tenantId),
        eq(userFavoriteShops.userId, userId),
        eq(userFavoriteShops.shopId, shopId)
      )
    )
    .returning();

  return c.json({ ok: true, deletedCount: deleted.length });
});

// Kullanıcının favori dükkanlarını listele
favoritesRouter.get("/shops", authMiddleware, async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const rawId = (c as unknown as { get: (k: string) => unknown }).get("userId");
  const backendId = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : undefined;
  const actorRoleHeader = (c as unknown as { get: (k: string) => unknown }).get("userRole") as string | undefined;
  const mapRows = backendId
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.id, backendId), eq(users.tenantId, tenantId))).limit(1)
    : [];
  const userId = mapRows[0]?.id;

  if (!userId) {
    return c.json({ error: "Kimlik doğrulama gerekli" }, 401);
  }
  if (actorRoleHeader !== "customer") {
    return c.json(
      { error: "Sadece müşteriler favorilerini listeleyebilir" },
      403
    );
  }

  const favorites = await db
    .select({
      id: userFavoriteShops.id,
      shopId: userFavoriteShops.shopId,
      userId: userFavoriteShops.userId,
      name: barberShops.name,
      gender: barberShops.gender,
      address: barberShops.address,
      phone: barberShops.phone,
      createdAt: userFavoriteShops.createdAt,
    })
    .from(userFavoriteShops)
    .innerJoin(barberShops, eq(barberShops.id, userFavoriteShops.shopId))
    .where(
      and(
        eq(userFavoriteShops.tenantId, tenantId),
        eq(userFavoriteShops.userId, userId)
      )
    );

  return c.json({ data: favorites });
});
