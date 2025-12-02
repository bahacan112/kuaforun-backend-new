import bcrypt from "bcryptjs"
import { db } from "../db"
import { users } from "../db/schema"
import { and, eq } from "drizzle-orm"
import { env } from "../core/env"

async function main() {
  const tenantId = env.TENANT_ID || "kuaforun"
  const email = process.env.ADMIN_EMAIL || "admin+kuaforun@example.com"
  const name = process.env.ADMIN_NAME || "Admin User"
  const plain = process.env.ADMIN_PASSWORD || "AdminPassw0rd!"
  const hash = await bcrypt.hash(plain, 10)

  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ passwordHash: hash, role: "admin", name })
      .where(and(eq(users.id, existing[0].id), eq(users.tenantId, tenantId)))
    console.log("updated-admin", { email, tenantId })
    return
  }

  const [created] = await db
    .insert(users)
    .values({ email, passwordHash: hash, name, role: "admin", tenantId })
    .returning()

  console.log("created-admin", { id: created.id, email, tenantId })
}

main().catch((e) => {
  console.error("create-admin-error", e)
  process.exit(1)
})