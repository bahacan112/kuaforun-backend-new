import { Hono } from "hono";
import type { Context } from "hono";
import type { Logger } from "../../core/logging/logger";
import type { AuthUser } from "../../core/clients/auth.client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../../db";
import {
  users,
  userFavoriteBarbers,
  userFavoriteShops,
  shopStaff,
  barberShops,
} from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { usersService } from "./users.service";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../core/middleware/auth.middleware";
import { resolveTenantId } from "@shared/config";

export const usersRouter = new Hono<{
  Variables: {
    logger: Logger;
    requestId: string;
    authUser?: AuthUser;
    userId?: string;
    userEmail?: string;
    userRole?: string;
  };
}>();

// Validation schemas
const createUserSchema = z.object({
  id: z.string().uuid(),
  gender: z.enum(["male", "female", "other"]).optional(),
  profileImageUrl: z.string().url().optional(),
  dateOfBirth: z.coerce.date().optional(),
  bio: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  preferences: z.record(z.string(), z.any()).optional(),
});
// Super-admin create DTO (name/email/role/phone/password)
const adminCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
});

const updateUserSchema = z.object({
  gender: z.enum(["male", "female", "other"]).optional(),
  profileImageUrl: z.string().url().optional(),
  dateOfBirth: z.coerce.date().optional(),
  bio: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  preferences: z.record(z.string(), z.any()).optional(),
});
// Super-admin update DTO (extend with name/email/role/phone/password)
const adminUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().min(1).optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
});

// GET /users - Get all users with pagination (Optional auth)
usersRouter.get("/", optionalAuthMiddleware, async (c: Context) => {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = (page - 1) * limit;

    const userList = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      data: userList,
      pagination: {
        page,
        limit,
        total: userList.length,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// GET /users/:id - Get user by ID (Optional auth)
usersRouter.get("/:id", optionalAuthMiddleware, async (c: Context) => {
  try {
    const id = c.req.param("id");

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (user.length === 0) {
      return c.json(
        {
          success: false,
          error: { message: "User not found" },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: user[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// GET /users/profile - Get current user profile (Auth required)
usersRouter.get("/profile", authMiddleware, async (c: Context) => {
  try {
    const rawId = c.get("userId") as unknown;
    const tenantId = c.req.header("x-tenant-id") || "kuaforun";

    const authUser = c.get("authUser");
    if (authUser) {
      return c.json({ success: true, data: authUser });
    }
    const userIdStr =
      typeof rawId === "string"
        ? rawId
        : typeof rawId === "number"
        ? String(rawId)
        : undefined;
    if (!userIdStr) {
      return c.json(
        {
          success: false,
          error: { message: "User not authenticated" },
        },
        401
      );
    }

    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userIdStr), eq(users.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) {
      return c.json(
        { success: false, error: { message: "User profile not found" } },
        404
      );
    }

    return c.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// GET /users/auth/:authUserId - Get user by Auth User ID (Enhanced with Auth service integration)
usersRouter.get("/auth/:authUserId", async (c: Context) => {
  try {
    const authUserId = c.req.param("authUserId");

    // Auth servisinden ve Backend servisinden tam profil bilgilerini al
    const completeProfile = await usersService.getUserByAuthId(authUserId);

    if (!completeProfile) {
      return c.json(
        {
          success: false,
          error: { message: "User not found" },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: completeProfile,
    });
  } catch (error) {
    console.error("Error fetching user by auth ID:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// POST /users - Create new user profile (Auth required)
usersRouter.post("/", authMiddleware, async (c: Context) => {
  try {
    const role = (c.get("userRole") as string | undefined) || "";
    if (role !== "admin") {
      return c.json({ success: false, error: { message: "Only super-admin can create profiles" } }, 403);
    }
    const body = await c.req.json();
    const tenantId = resolveTenantId(c.req.header());
    // Branch: admin create with name/email OR profile create with id
    if (body && typeof body === "object" && ("name" in body || "email" in body)) {
      const parsed = adminCreateSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ success: false, error: { message: "Validation error", details: parsed.error.flatten() } }, 400);
      }
      const { name, email, role: userRole, phone, password } = parsed.data;
      const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
      const created = await db
        .insert(users)
        .values({ name, email, role: userRole as any, phone, passwordHash, tenantId })
        .returning();
      const u = created[0];
      return c.json({ success: true, data: { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone } }, 201);
    } else {
      const validatedData = createUserSchema.parse(body);
      const newProfile = await usersService.createUserProfile(validatedData);
      if (!newProfile) {
        return c.json({ success: false, error: { message: "Failed to create user profile or user not found in Auth service" } }, 400);
      }
      return c.json({ success: true, data: newProfile }, 201);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: { message: "Validation error", details: error.issues },
        },
        400
      );
    }

    console.error("Error creating user:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// PUT /users/:id - Update user profile (Auth required)
usersRouter.put("/:id", authMiddleware, async (c: Context) => {
  try {
    const role = (c.get("userRole") as string | undefined) || "";
    if (role !== "admin") {
      return c.json({ success: false, error: { message: "Only super-admin can update profiles" } }, 403);
    }
    const id = c.req.param("id");
    const body = await c.req.json();
    const tenantId = resolveTenantId(c.req.header());
    // Try admin update
    const adminParsed = adminUpdateSchema.safeParse(body);
    if (adminParsed.success) {
      const changes: any = {};
      const { name, email, role: userRole, phone, password } = adminParsed.data;
      if (name !== undefined) changes.name = name;
      if (email !== undefined) changes.email = email;
      if (userRole !== undefined) changes.role = userRole as any;
      if (phone !== undefined) changes.phone = phone;
      if (password !== undefined) changes.passwordHash = await bcrypt.hash(password, 10);
      changes.updatedAt = new Date();
      const updated = await db
        .update(users)
        .set(changes)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .returning();
      if (updated.length === 0) {
        return c.json({ success: false, error: { message: "User not found" } }, 404);
      }
      const u = updated[0];
      return c.json({ success: true, data: { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone } });
    }

    // Fallback to profile update schema
    const validatedData = updateUserSchema.parse(body);
    const updatedProfile = await usersService.updateUserProfileById(id, validatedData);
    if (!updatedProfile) {
      return c.json({ success: false, error: { message: "User not found" } }, 404);
    }
    return c.json({ success: true, data: updatedProfile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: { message: "Validation error", details: error.issues },
        },
        400
      );
    }

    console.error("Error updating user:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// DELETE /users/:id - Delete user profile (Auth required)
usersRouter.delete("/:id", authMiddleware, async (c: Context) => {
  try {
    const role = (c.get("userRole") as string | undefined) || "";
    if (role !== "admin") {
      return c.json({ success: false, error: { message: "Only super-admin can delete profiles" } }, 403);
    }
    const id = c.req.param("id");

    // Service katmanı üzerinden kullanıcı profilini ID ile sil
    const success = await usersService.deleteUserProfileById(id);

    if (!success) {
      return c.json(
        {
          success: false,
          error: { message: "User not found" },
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "User profile deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      500
    );
  }
});

// -----------------------------
// /users/me/favorites - Kişisel favoriler
// -----------------------------

// GET /users/me/favorites/barbers - Kullanıcının favori berberleri
usersRouter.get("/me/favorites/barbers", authMiddleware, async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const userId = c.get("userId") as string | undefined;
  const userRole = c.get("userRole") as string | undefined;
  const shopIdParam = c.req.query("shopId");
  const shopId = shopIdParam ? Number(shopIdParam) : undefined;

  if (!userId) {
    return c.json(
      { success: false, error: { message: "Kimlik doğrulama gerekli" } },
      401
    );
  }
  if (userRole !== "customer") {
    return c.json(
      {
        success: false,
        error: { message: "Sadece müşteriler favorilerini görebilir" },
      },
      403
    );
  }

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
        ...(shopId !== undefined ? [eq(shopStaff.shopId, String(shopId))] : [])
      )
    );

  return c.json({ success: true, data: favorites });
});

// POST /users/me/favorites/barbers/:staffId - Favori berber ekle
usersRouter.post(
  "/me/favorites/barbers/:staffId",
  authMiddleware,
  async (c: Context) => {
    const tenantId = resolveTenantId(c.req.header());
    const userId = c.get("userId") as string | undefined;
    const userRole = c.get("userRole") as string | undefined;
    const staffId = c.req.param("staffId");

    if (!userId) {
      return c.json(
        { success: false, error: { message: "Kimlik doğrulama gerekli" } },
        401
      );
    }
    if (userRole !== "customer") {
      return c.json(
        {
          success: false,
          error: { message: "Sadece müşteriler favori ekleyebilir" },
        },
        403
      );
    }
    if (!staffId) {
      return c.json(
        { success: false, error: { message: "Geçersiz staffId" } },
        400
      );
    }

    const staffRows = await db
      .select()
      .from(shopStaff)
      .where(and(eq(shopStaff.id, staffId), eq(shopStaff.tenantId, tenantId)))
      .limit(1);
    if (staffRows.length === 0) {
      return c.json(
        { success: false, error: { message: "Berber/staff bulunamadı" } },
        404
      );
    }

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
      return c.json({ success: true, data: existing[0] });
    }

    const inserted = await db
      .insert(userFavoriteBarbers)
      .values({ tenantId, userId, staffId })
      .returning();

    return c.json({ success: true, data: inserted[0] }, 201);
  }
);

// DELETE /users/me/favorites/barbers/:staffId - Favori berber çıkar
usersRouter.delete(
  "/me/favorites/barbers/:staffId",
  authMiddleware,
  async (c: Context) => {
    const tenantId = resolveTenantId(c.req.header());
    const userId = c.get("userId") as string | undefined;
    const userRole = c.get("userRole") as string | undefined;
    const staffId = c.req.param("staffId");

    if (!userId) {
      return c.json(
        { success: false, error: { message: "Kimlik doğrulama gerekli" } },
        401
      );
    }
    if (userRole !== "customer") {
      return c.json(
        {
          success: false,
          error: { message: "Sadece müşteriler favori kaldırabilir" },
        },
        403
      );
    }
    if (!staffId) {
      return c.json(
        { success: false, error: { message: "Geçersiz staffId" } },
        400
      );
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

    return c.json({ success: true, deletedCount: deleted.length });
  }
);

// GET /users/me/favorites/shops - Kullanıcının favori dükkanları
usersRouter.get("/me/favorites/shops", authMiddleware, async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const userId = c.get("userId") as string | undefined;
  const userRole = c.get("userRole") as string | undefined;

  if (!userId) {
    return c.json(
      { success: false, error: { message: "Kimlik doğrulama gerekli" } },
      401
    );
  }
  if (userRole !== "customer") {
    return c.json(
      {
        success: false,
        error: { message: "Sadece müşteriler favorilerini görebilir" },
      },
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

  return c.json({ success: true, data: favorites });
});

// POST /users/me/favorites/shops/:shopId - Favori dükkan ekle
usersRouter.post("/me/favorites/shops/:shopId", authMiddleware, async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const userId = c.get("userId") as string | undefined;
  const userRole = c.get("userRole") as string | undefined;
  const shopIdParam = c.req.param("shopId");
  const shopId = shopIdParam;

  if (!userId) {
    return c.json(
      { success: false, error: { message: "Kimlik doğrulama gerekli" } },
      401
    );
  }
  if (userRole !== "customer") {
    return c.json(
      {
        success: false,
        error: { message: "Sadece müşteriler favori ekleyebilir" },
      },
      403
    );
  }
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  ) {
    return c.json(
      { success: false, error: { message: "Geçersiz shopId formatı" } },
      400
    );
  }

  const shopRows = await db
    .select()
    .from(barberShops)
    .where(eq(barberShops.id, shopId))
    .limit(1);
  if (shopRows.length === 0) {
    return c.json(
      { success: false, error: { message: "Dükkan bulunamadı" } },
      404
    );
  }

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
    return c.json({ success: true, data: existing[0] });
  }

  const inserted = await db
    .insert(userFavoriteShops)
    .values({ tenantId, userId, shopId })
    .returning();

  return c.json({ success: true, data: inserted[0] }, 201);
});

// DELETE /users/me/favorites/shops/:shopId - Favori dükkan çıkar
usersRouter.delete("/me/favorites/shops/:shopId", authMiddleware, async (c: Context) => {
  const tenantId = resolveTenantId(c.req.header());
  const userId = c.get("userId") as string | undefined;
  const userRole = c.get("userRole") as string | undefined;
  const shopIdParam = c.req.param("shopId");
  const shopId = shopIdParam;

  if (!userId) {
    return c.json(
      { success: false, error: { message: "Kimlik doğrulama gerekli" } },
      401
    );
  }
  if (userRole !== "customer") {
    return c.json(
      {
        success: false,
        error: { message: "Sadece müşteriler favori kaldırabilir" },
      },
      403
    );
  }
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  ) {
    return c.json(
      { success: false, error: { message: "Geçersiz shopId formatı" } },
      400
    );
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

  return c.json({ success: true, deletedCount: deleted.length });
});
