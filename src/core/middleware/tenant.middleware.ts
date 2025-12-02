import type { Context, Next } from "hono";

/**
 * Tenant middleware - Extract tenant ID from headers and set in context
 */
export async function tenantMiddleware(c: Context, next: Next) {
  try {
    const tenantId = c.req.header("x-tenant-id");
    if (!tenantId) {
      return c.json(
        {
          success: false,
          error: { message: "X-Tenant-Id header required" },
        },
        400
      );
    }
    c.set("tenantId", tenantId);
    await next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    return c.json(
      {
        success: false,
        error: { message: "Tenant processing failed" },
      },
      500
    );
  }
}
