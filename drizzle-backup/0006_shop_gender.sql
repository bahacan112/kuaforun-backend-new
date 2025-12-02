-- 0006_shop_gender.sql
-- Add enum type and column for shop gender (women/men/unisex)

DO $$ BEGIN
  CREATE TYPE "public"."shop_gender" AS ENUM ('male', 'female', 'unisex');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "barber_shops"
  ADD COLUMN IF NOT EXISTS "gender" shop_gender NOT NULL DEFAULT 'unisex';