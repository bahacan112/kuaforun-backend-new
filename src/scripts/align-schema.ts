import { pool } from "../db";

async function run(sql: string) {
  await pool.query(sql);
}

async function main() {
  console.log("Aligning remote schema to expected structure...");

  // Create drizzle schema to allow migrator tracking in future
  await run('CREATE SCHEMA IF NOT EXISTS "drizzle"');

  // Ensure user_role enum exists and includes salon_owner
  await run(`DO $$ BEGIN
    CREATE TYPE "user_role" AS ENUM ('admin', 'supervisor', 'barber', 'salon_owner', 'customer');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`);
  await run(`DO $$ BEGIN
    ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'salon_owner';
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;`);

  // Add missing columns if not exist
  // Tenant ID (for multi-tenant support)
  await run('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" text');
  await run(`ALTER TABLE "users" ALTER COLUMN "tenant_id" SET DEFAULT 'main'`);
  await run(`UPDATE "users" SET "tenant_id" = COALESCE("tenant_id", 'main')`);
  await run(`ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL`);

  // Basic user fields
  await run('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar(120)');
  await run('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role"');
  await run(
    'ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT \'' + "customer" + "'"
  );
  await run('ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL');
  await run(
    'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now() NOT NULL'
  );
  await run(
    'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL'
  );

  // Ensure unique index on email
  await run(
    'CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email")'
  );

  console.log("Schema alignment complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Align schema failed:", err);
  process.exit(1);
});
