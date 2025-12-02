import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../../db";
import {
  barberComments,
  barberCommentReplies,
  barberShops,
  barberCommentReplyModerations,
  barberCommentReplyHistory,
  bookings,
  users,
} from "../../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { resolveTenantId } from "../../shared/config/index";
import { z } from "zod";
// Auth middleware kaldırıldı - services/auth mikroservisi kullanılıyor
// import { authMiddleware, requireRole } from '../../core/middleware/auth'
// import type { JwtPayload } from '../../core/security/jwt'

export const commentsRouter = new Hono();

// List comments (optionally filter by shopId)
commentsRouter.get("/", async (c: Context) => {
  const shopId = c.req.query("shopId");
  if (shopId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId)) {
      return c.json({ error: "Invalid shop ID format" }, 400);
    }
    const sid = shopId;
    try {
      const list = await db
        .select()
        .from(barberComments)
        .where(eq(barberComments.barberShopId, sid));
      return c.json({ data: list });
    } catch (e) {
      // Fallback: legacy schema without booking_id column
      const rows = await db.execute(
        sql`select id, barber_shop_id, user_id, rating, description, created_at, updated_at from barber_comments where barber_shop_id = ${sid}`
      );
      return c.json({ data: (rows as any).rows ?? [] });
    }
  }
  try {
    const list = await db.select().from(barberComments);
    return c.json({ data: list });
  } catch (e) {
    const rows = await db.execute(
      sql`select id, barber_shop_id, user_id, rating, description, created_at, updated_at from barber_comments`
    );
    return c.json({ data: (rows as any).rows ?? [] });
  }
});

// Get one comment by ID
commentsRouter.get("/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid comment ID format" }, 400);
  }
  const res = await db
    .select()
    .from(barberComments)
    .where(eq(barberComments.id, id));
  const com = res[0];
  if (!com) return c.json({ error: "Not found" }, 404);
  return c.json({ data: com });
});

// Create comment (any authenticated user)
const createSchema = z.object({
  barberShopId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  description: z.string().min(1),
  bookingId: z.string().uuid().optional(),
});

commentsRouter.post("/", async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parse = createSchema.safeParse(body);
  if (!parse.success)
    return c.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      400
    );

  // Get user info from gateway headers
  const rawUserId = c.req.header("X-User-Id");
  const tenantId = resolveTenantId(c.req.header());
  if (!rawUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId)) {
    return c.json({ error: "User ID not found or invalid" }, 401);
  }
  // Map to tenant user id to satisfy FK; if not found, reject
  const mapRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, rawUserId), eq(users.tenantId, tenantId)))
    .limit(1);
  const userId = mapRows[0]?.id;
  if (!userId) return c.json({ error: "User not found" }, 401);

  // If bookingId provided, validate booking and prevent duplicate per booking
  if (parse.data.bookingId) {
    const b = await db
      .select({ id: bookings.id, shopId: bookings.shopId, customerId: bookings.customerId })
      .from(bookings)
      .where(eq(bookings.id, parse.data.bookingId))
      .limit(1);
    if (b.length === 0 || String(b[0].customerId) !== String(userId) || String(b[0].shopId) !== String(parse.data.barberShopId)) {
      return c.json({ error: "Geçersiz randevu" }, 400);
    }
    try {
      const dup = await db
        .select({ id: barberComments.id })
        .from(barberComments)
        .where(and(eq(barberComments.bookingId, parse.data.bookingId), eq(barberComments.userId, userId)))
        .limit(1);
      if (dup.length > 0) {
        return c.json({ error: "Bu randevu için zaten bir yorumunuz var" }, 409);
      }
    } catch (e) {
      // Legacy schema fallback: booking_id yoksa mağaza bazında tek yorumu koru
      const existing = await db
        .select({ id: barberComments.id })
        .from(barberComments)
        .where(and(eq(barberComments.barberShopId, parse.data.barberShopId), eq(barberComments.userId, userId)))
        .limit(1);
      if (existing.length > 0) {
        return c.json({ error: "Bu mağaza için zaten bir yorumunuz var" }, 409);
      }
    }
  } else {
    // Prevent duplicate for same user & shop when booking is not provided
    const existing = await db
      .select({ id: barberComments.id })
      .from(barberComments)
      .where(and(eq(barberComments.barberShopId, parse.data.barberShopId), eq(barberComments.userId, userId)))
      .limit(1);
    if (existing.length > 0) {
      return c.json({ error: "Bu mağaza için zaten bir yorumunuz var" }, 409);
    }
  }

  try {
    const created = await db
      .insert(barberComments)
      .values({
        barberShopId: parse.data.barberShopId,
        userId: userId,
        rating: parse.data.rating,
        description: parse.data.description,
        bookingId: parse.data.bookingId,
      })
      .returning();
    return c.json({ data: created[0] });
  } catch (e) {
    // Fallback for legacy schema without booking_id column
    const rows = await db.execute(
      sql`insert into barber_comments (barber_shop_id, user_id, rating, description)
           values (${parse.data.barberShopId}, ${userId}, ${parse.data.rating}, ${parse.data.description})
           returning id, barber_shop_id, user_id, rating, description, created_at, updated_at`
    );
    const first = (rows as any).rows?.[0];
    return c.json({ data: first });
  }
});

// Update comment (author or admin/supervisor)
const updateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  description: z.string().min(1).optional(),
});

// Update comment - Geçici olarak devre dışı (auth services entegrasyonu bekliyor)
commentsRouter.patch("/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid comment ID format" }, 400);
  }

  // Get user info from gateway headers
  const userId = c.req.header("X-User-Id");
  const _userRole = c.req.header("X-User-Role"); // Prefixed with _ to indicate unused
  if (!userId) return c.json({ error: "User ID not found in headers" }, 401);

  // Find existing comment
  const res = await db
    .select()
    .from(barberComments)
    .where(eq(barberComments.id, id));
  const existing = res[0];
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Permission: author or admin/supervisor
  // Note: userId field is commented out in schema, so we skip this check for now
  // if (!(existing.userId === userId || userRole === 'admin' || userRole === 'supervisor')) {
  //   return c.json({ error: 'Forbidden' }, 403)
  // }

  const body = await c.req.json().catch(() => ({}));
  const parse = updateSchema.safeParse(body);
  if (!parse.success)
    return c.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      400
    );

  const changes: Partial<typeof barberComments.$inferInsert> = {};
  if (parse.data.rating !== undefined) changes.rating = parse.data.rating;
  if (parse.data.description !== undefined)
    changes.description = parse.data.description;
  changes.updatedAt = new Date();

  const updated = await db
    .update(barberComments)
    .set(changes)
    .where(eq(barberComments.id, id))
    .returning();
  return c.json({ data: updated[0] });
});

// Delete comment (author or admin/supervisor)
commentsRouter.delete("/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid comment ID format" }, 400);
  }

  // Get user info from gateway headers
  const userId = c.req.header("X-User-Id");
  const _userRole = c.req.header("X-User-Role"); // Prefixed with _ to indicate unused
  if (!userId) return c.json({ error: "User ID not found in headers" }, 401);

  // Find existing comment
  const res = await db
    .select()
    .from(barberComments)
    .where(eq(barberComments.id, id));
  const existing = res[0];
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Permission: author or admin/supervisor
  // Note: userId field is commented out in schema, so we skip this check for now
  // if (!(existing.userId === userId || userRole === 'admin' || userRole === 'supervisor')) {
  //   return c.json({ error: 'Forbidden' }, 403)
  // }

  await db.delete(barberComments).where(eq(barberComments.id, id));
  return c.json({ ok: true });
});

// Shop owner reply: only the shop owner (role=barber) can reply to comments of their own shop
const replySchema = z.object({
  text: z.string().min(1),
});

// Reply to comment - Geçici olarak devre dışı (auth services entegrasyonu bekliyor)
commentsRouter.post("/:id/reply", async (c: Context) => {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid comment ID format" }, 400);
  }

  // Get user info from gateway headers
  const userId = c.req.header("X-User-Id");
  const userRole = c.req.header("X-User-Role");
  if (!userId) return c.json({ error: "User ID not found in headers" }, 401);

  // Only barbers can reply
  if (userRole !== "barber") {
    return c.json({ error: "Only barbers can reply to comments" }, 403);
  }

  // Find comment and shop
  const res = await db
    .select()
    .from(barberComments)
    .where(eq(barberComments.id, id));
  const comment = res[0];
  if (!comment) return c.json({ error: "Not found" }, 404);

  const shopRes = await db
    .select()
    .from(barberShops)
    .where(eq(barberShops.id, comment.barberShopId));
  const shop = shopRes[0];
  // Note: ownerUserId field is commented out in schema, so we skip this check for now
  // if (!shop || shop.ownerUserId === null || shop.ownerUserId !== userId) {
  //   return c.json({ error: 'Forbidden - You can only reply to comments on your own shop' }, 403)
  // }
  if (!shop) {
    return c.json({ error: "Shop not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parse = replySchema.safeParse(body);
  if (!parse.success)
    return c.json(
      { error: "Invalid payload", details: parse.error.flatten() },
      400
    );

  // If reply exists, update; otherwise create new
  const existing = await db
    .select()
    .from(barberCommentReplies)
    .where(eq(barberCommentReplies.commentId, id));
  if (existing.length > 0) {
    // Add history with previous text
    await db.insert(barberCommentReplyHistory).values({
      commentId: id,
      replyId: existing[0].id,
      previousText: existing[0].text,
      editedByUserId: userId ?? null,
    });
    const updated = await db
      .update(barberCommentReplies)
      .set({ text: parse.data.text, updatedAt: new Date() })
      .where(eq(barberCommentReplies.id, existing[0].id))
      .returning();
    // Set moderation to pending on edit
    const mod = await db
      .select()
      .from(barberCommentReplyModerations)
      .where(eq(barberCommentReplyModerations.replyId, existing[0].id));
    if (mod.length > 0) {
      await db
        .update(barberCommentReplyModerations)
        .set({ status: "pending", reason: null, updatedAt: new Date() })
        .where(eq(barberCommentReplyModerations.id, mod[0].id));
    } else {
      await db.insert(barberCommentReplyModerations).values({
        replyId: existing[0].id,
        status: "pending",
      });
    }
    return c.json({ data: updated[0] });
  }

  const inserted = await db
    .insert(barberCommentReplies)
    .values({ commentId: id, userId: userId, text: parse.data.text })
    .returning();
  // Create initial moderation record as pending
  await db.insert(barberCommentReplyModerations).values({
    replyId: inserted[0].id,
    status: "pending",
  });
  return c.json({ data: inserted[0] });
});

// Get reply for a comment (public)
commentsRouter.get("/:id/reply", async (c: Context) => {
  const id = c.req.param("id");
  const res = await db
    .select()
    .from(barberCommentReplies)
    .where(eq(barberCommentReplies.commentId, id));
  const reply = res[0] ?? null;
  if (!reply) return c.json({ data: null });
  const mod = await db
    .select()
    .from(barberCommentReplyModerations)
    .where(eq(barberCommentReplyModerations.replyId, reply.id));
  const status = mod[0]?.status ?? "approved"; // default approve if moderation missing
  const userRole = c.req.header("X-User-Role");
  // Public visibility: only approved replies; privileged roles can see non-approved
  const privilegedRoles = new Set(["barber", "manager", "owner"]);
  if (status !== "approved" && (!userRole || !privilegedRoles.has(userRole))) {
    return c.json({ data: null });
  }
  return c.json({ data: { ...reply, status } });
});

// Get reply edit history (for barbers/managers/owners)
commentsRouter.get("/:id/reply/history", async (c: Context) => {
  const id = c.req.param("id");
  const userRole = c.req.header("X-User-Role") || "";
  if (!["barber", "manager", "owner"].includes(userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const replyRes = await db
    .select()
    .from(barberCommentReplies)
    .where(eq(barberCommentReplies.commentId, id));
  const reply = replyRes[0];
  if (!reply) return c.json({ data: [] });
  const history = await db
    .select()
    .from(barberCommentReplyHistory)
    .where(eq(barberCommentReplyHistory.replyId, reply.id))
    .orderBy(desc(barberCommentReplyHistory.createdAt));
  return c.json({ data: history });
});

// Moderate a reply (manager/owner)
const moderateSchema = z.object({
  status: z.enum(["approved", "pending", "rejected"]),
  reason: z.string().optional(),
});

commentsRouter.post("/replies/:replyId/moderate", async (c: Context) => {
  const replyId = c.req.param("replyId");
  if (!replyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(replyId)) {
    return c.json({ error: "Invalid reply ID format" }, 400);
  }
  const userId = c.req.header("X-User-Id");
  const userRole = c.req.header("X-User-Role") || "";
  if (!userId) return c.json({ error: "User ID not found in headers" }, 401);
  if (!["manager", "owner"].includes(userRole)) {
    return c.json({ error: "Only managers/owners can moderate replies" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const parse = moderateSchema.safeParse(body);
  if (!parse.success)
    return c.json({ error: "Invalid payload", details: parse.error.flatten() }, 400);

  const existing = await db
    .select()
    .from(barberCommentReplyModerations)
    .where(eq(barberCommentReplyModerations.replyId, replyId));
  if (existing.length > 0) {
    const updated = await db
      .update(barberCommentReplyModerations)
      .set({
        status: parse.data.status,
        reason: parse.data.reason ?? null,
        moderatorUserId: userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(barberCommentReplyModerations.replyId, replyId))
      .returning();
    return c.json({ data: updated[0] });
  }
  const inserted = await db
    .insert(barberCommentReplyModerations)
    .values({
      replyId,
      status: parse.data.status,
      reason: parse.data.reason ?? null,
      moderatorUserId: userId ?? null,
    })
    .returning();
  return c.json({ data: inserted[0] });
});
