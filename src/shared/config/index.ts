type HeadersLike = Record<string, string | undefined>

export const config = {
  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:5000",
  },
  storage: {
    s3: {
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
}

export function resolveTenantId(headers?: HeadersLike): string {
  const raw = headers?.["x-tenant-id"] || headers?.["X-Tenant-Id"]
  const value = typeof raw === "string" ? raw : undefined
  if (value) return value.split(",").map((s) => s.trim()).filter(Boolean)[0] || (process.env.DEFAULT_TENANT_ID || "kuaforun")
  return process.env.DEFAULT_TENANT_ID || "kuaforun"
}
