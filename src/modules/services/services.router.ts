import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../../db";
import { services } from "../../db/schema";
import { eq } from "drizzle-orm";
// import { z } from 'zod' // Commented out as not used
// Auth middleware kaldırıldı - services/auth mikroservisi kullanılıyor
// import { authMiddleware, requireRole } from '../../core/middleware/auth'
// import type { JwtPayload } from '../../core/security/jwt'
import { AppError } from "../../core/errors";
import { ServiceCreateDto, ServiceUpdateDto, ServiceTemplateCreateDto, ServiceTemplateUpdateDto, ApplyServiceTemplateDto } from "./services.dto";
import { ServicesService } from "./services.service";
import { serviceTemplates, barberShops } from "../../db/schema";
import { and } from "drizzle-orm";

export const servicesRouter = new Hono();
const servicesService = new ServicesService();

// Get service templates (must be defined before /:id route)
servicesRouter.get("/templates", async (c: Context) => {
  const gender = c.req.query("gender") as
    | "male"
    | "female"
    | "unisex"
    | undefined;
  try {
    const templates = await servicesService.getActiveServiceTemplates(gender);
    return c.json({
      success: true,
      data: templates,
    });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// Create template
servicesRouter.post("/templates", async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parse = ServiceTemplateCreateDto.safeParse(body);
  if (!parse.success)
    throw new AppError("Invalid payload", 422, "VALIDATION_ERROR", parse.error.flatten());
  const payload: typeof serviceTemplates.$inferInsert = {
    name: parse.data.serviceName,
    gender: parse.data.type as any,
    defaultPrice: parse.data.price.toString(),
    defaultDurationMinutes: parse.data.durationMinutes,
    description: parse.data.description,
    category: parse.data.category,
    isActive: true,
  };
  const created = await db.insert(serviceTemplates).values(payload).returning();
  return c.json({ data: created[0] });
});

// Update template
servicesRouter.patch("/templates/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid template ID format" }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parse = ServiceTemplateUpdateDto.safeParse(body);
  if (!parse.success)
    throw new AppError("Invalid payload", 422, "VALIDATION_ERROR", parse.error.flatten());
  const changes: Partial<typeof serviceTemplates.$inferInsert> = {};
  if (parse.data.serviceName !== undefined) changes.name = parse.data.serviceName;
  if (parse.data.type !== undefined) changes.gender = parse.data.type as any;
  if (parse.data.price !== undefined) changes.defaultPrice = parse.data.price.toString();
  if (parse.data.durationMinutes !== undefined) changes.defaultDurationMinutes = parse.data.durationMinutes;
  if (parse.data.description !== undefined) changes.description = parse.data.description;
  if (parse.data.category !== undefined) changes.category = parse.data.category;
  changes.updatedAt = new Date();
  const updated = await db.update(serviceTemplates).set(changes).where(eq(serviceTemplates.id, id)).returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ data: updated[0] });
});

// Delete template
servicesRouter.delete("/templates/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Invalid template ID format" }, 400);
  }
  const deleted = await db.delete(serviceTemplates).where(eq(serviceTemplates.id, id)).returning();
  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// List services (optionally filter by shopId)
servicesRouter.get("/", async (c: Context) => {
  const shopId = c.req.query("shopId");
  if (shopId) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        shopId
      )
    ) {
      return c.json({ error: "Invalid shop ID format" }, 400);
    }
    const sid = shopId;
    const list = await db
      .select()
      .from(services)
      .where(eq(services.barberShopId, sid));
    return c.json({ data: list });
  }
  const list = await db.select().from(services);
  return c.json({ data: list });
});

// Get one service by ID
servicesRouter.get("/:id", async (c: Context) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid service ID format" }, 400);
  }
  const res = await db.select().from(services).where(eq(services.id, id));
  const svc = res[0];
  if (!svc) return c.json({ error: "Not found" }, 404);
  return c.json({ data: svc });
});

// Create service (admin or supervisor)
// Removed local createSchema; using ServiceCreateDto
servicesRouter.post("/", async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parse = ServiceCreateDto.safeParse(body);
  if (!parse.success)
    throw new AppError(
      "Invalid payload",
      422,
      "VALIDATION_ERROR",
      parse.error.flatten()
    );

  const created = await db
    .insert(services)
    .values({
      barberShopId: parse.data.barberShopId,
      name: parse.data.name,
      price: parse.data
        .price as unknown as (typeof services.$inferInsert)["price"],
      durationMinutes: parse.data.durationMinutes,
    })
    .returning();

  return c.json({ data: created[0] });
});

// Update service (partial) (admin or supervisor)
// Removed local updateSchema; using ServiceUpdateDto
servicesRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid service ID format" }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parse = ServiceUpdateDto.safeParse(body);
  if (!parse.success)
    throw new AppError(
      "Invalid payload",
      422,
      "VALIDATION_ERROR",
      parse.error.flatten()
    );

  const changes: Partial<typeof services.$inferInsert> = {};
  if (parse.data.barberShopId !== undefined)
    changes.barberShopId = parse.data.barberShopId;
  if (parse.data.name !== undefined) changes.name = parse.data.name;
  if (parse.data.price !== undefined)
    changes.price = parse.data
      .price as unknown as (typeof services.$inferInsert)["price"];
  if (parse.data.durationMinutes !== undefined)
    changes.durationMinutes = parse.data.durationMinutes;
  changes.updatedAt = new Date();

  const updated = await db
    .update(services)
    .set(changes)
    .where(eq(services.id, id))
    .returning();
  if (updated.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ data: updated[0] });
});

// Delete service (admin or supervisor)
servicesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Invalid service ID format" }, 400);
  }
  const deleted = await db
    .delete(services)
    .where(eq(services.id, id))
    .returning();
  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Seed service templates
servicesRouter.post("/seed-templates", async (c) => {
  try {
    const result = await servicesService.seedServiceTemplates();
    return c.json({
      success: true,
      message: `${result.inserted} şablon eklendi, ${result.skipped} şablon zaten mevcuttu`,
      data: result,
    });
  } catch {
    return c.json({ success: true, message: "Şablonlar eklenemedi (boş geçildi)", data: { inserted: 0, skipped: 0 } }, 200);
  }
});

// Add default services to shop
servicesRouter.post("/add-defaults/:shopId", async (c) => {
  const shopId = c.req.param("shopId");
  if (
    !shopId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      shopId
    )
  ) {
    throw new AppError("Invalid shop ID format", 400, "INVALID_SHOP_ID");
  }

  try {
    const result = await servicesService.addDefaultServicesToShop(shopId);
    return c.json({
      success: true,
      message: `${result.added} hizmet eklendi (${result.shopGender} kuaförü)`,
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Failed to add default services",
      500,
      "ADD_DEFAULTS_ERROR"
    );
  }
});

// Apply templates to shop (optionally set gender first)
servicesRouter.post("/templates/apply", async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parse = ApplyServiceTemplateDto.safeParse(body);
  if (!parse.success)
    throw new AppError("Invalid payload", 422, "VALIDATION_ERROR", parse.error.flatten());
  const { shopId, type } = parse.data;
  if (type) {
    // Update shop gender if provided
    await db.update(barberShops).set({ gender: type as any, updatedAt: new Date() }).where(eq(barberShops.id, shopId));
  }
  const result = await servicesService.addDefaultServicesToShop(shopId);
  return c.json({ success: true, data: result });
});
