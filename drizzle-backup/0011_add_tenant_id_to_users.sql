-- Add tenant_id to users table to match application schema
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" text;

-- Backfill existing rows with default tenant value if NULL
UPDATE "users" SET "tenant_id" = COALESCE("tenant_id", 'kuaforun');

-- Enforce NOT NULL now that values exist
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;