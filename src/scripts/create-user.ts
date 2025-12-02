import bcrypt from "bcryptjs"
import { db } from "../db"
import { users } from "../db/schema"
import { and, eq } from "drizzle-orm"
import { env } from "../core/env"

async function main() {
  const tenantId = env.TENANT_ID || "kuaforun"
  const email = process.env.USER_EMAIL || "user+kuaforun@example.com"
  const name = process.env.USER_NAME || "Customer User"
  const plain = process.env.USER_PASSWORD || "UserPassw0rd!"
  const hash = await bcrypt.hash(plain, 10)

  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ passwordHash: hash, role: "customer", name })
      .where(and(eq(users.id, existing[0].id), eq(users.tenantId, tenantId)))
    console.log("updated-user", { email, tenantId })
    return
  }

  const [created] = await db
    .insert(users)
    .values({ email, passwordHash: hash, name, role: "customer", tenantId })
    .returning()

  console.log("created-user", { id: created.id, email, tenantId })
}

main().catch((e) => {
  console.error("create-user-error", e)
  process.exit(1)
})