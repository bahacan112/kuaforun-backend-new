import { Hono } from "hono"
import type { Context } from "hono"
import { randomUUID } from "node:crypto"
import { tenantMiddleware } from "../../core/middleware/tenant.middleware"
import { getPresignedPutUrl } from "../../core/storage/s3"

export const mediaRouter = new Hono()

mediaRouter.use("/*", tenantMiddleware)

mediaRouter.post("/uploads/url", async (c: Context) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const objectKey = String(body.objectKey || "").trim()
  const contentType = typeof body.contentType === "string" ? body.contentType : undefined
  if (!objectKey) return c.json({ error: "objectKey gerekli" }, 400)
  try {
    const { uploadUrl, expiresIn } = await getPresignedPutUrl(objectKey, contentType)
    return c.json({ uploadUrl, objectKey, expiresIn })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return c.json({ error: msg }, 500)
  }
})

mediaRouter.post("/uploads/confirm", async (c: Context) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const objectKey = String(body.objectKey || "").trim()
  const originalName = typeof body.originalName === "string" ? body.originalName : undefined
  const contentType = typeof body.contentType === "string" ? body.contentType : undefined
  const size = typeof body.size === "number" ? body.size : undefined
  const ownerType = typeof body.ownerType === "string" ? body.ownerType : undefined
  const ownerId = typeof body.ownerId === "string" ? body.ownerId : undefined
  if (!objectKey) return c.json({ error: "objectKey gerekli" }, 400)
  const id = randomUUID()
  // Build public URL if configured
  // Reuse logic from s3.ts via simple path: the frontend only needs a publicUrl if available
  // We avoid extra DB writes here; later can be extended to persist records
  const base = process.env.S3_PUBLIC_BASE_URL
  const bucket = process.env.S3_BUCKET
  let publicUrl: string | null = null
  if (base && bucket) {
    try {
      const u = new URL(base)
      u.pathname = [u.pathname.replace(/\/$/, ""), bucket, objectKey].filter(Boolean).join("/")
      publicUrl = u.toString()
    } catch {
      publicUrl = null
    }
  }
  const tenantHeader = c.req.header("x-tenant-id") || c.req.header("X-Tenant-Id") || "main"
  return c.json({
    id,
    tenantId: tenantHeader ?? null,
    provider: "s3",
    bucket: bucket ?? null,
    objectKey,
    contentType: contentType ?? null,
    size: size ?? null,
    originalName: originalName ?? null,
    publicUrl,
    ownerType: ownerType ?? undefined,
    ownerId: ownerId ?? undefined,
  })
})

export default mediaRouter