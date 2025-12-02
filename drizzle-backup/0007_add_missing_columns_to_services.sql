-- Add missing columns to services table
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "category" varchar(100);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;