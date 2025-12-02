-- Add tenant_id to bookings and booking_services; introduce staff modeling tables

-- 1) Add tenant_id to bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "tenant_id" text;
UPDATE "bookings" SET "tenant_id" = COALESCE("tenant_id", 'kuaforun');
ALTER TABLE "bookings" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Index to improve tenant scoping
CREATE INDEX IF NOT EXISTS "bookings_tenant_idx" ON "bookings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "bookings_shop_tenant_idx" ON "bookings" ("shop_id", "tenant_id");

-- 2) Add tenant_id to booking_services
ALTER TABLE "booking_services" ADD COLUMN IF NOT EXISTS "tenant_id" text;
UPDATE "booking_services" SET "tenant_id" = COALESCE("tenant_id", 'kuaforun');
ALTER TABLE "booking_services" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Drop old unique index and recreate including tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'booking_service_unique'
  ) THEN
    DROP INDEX "booking_service_unique";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "booking_service_unique" ON "booking_services" ("booking_id", "service_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "booking_services_tenant_idx" ON "booking_services" ("tenant_id");

-- 3) Staff role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
    CREATE TYPE staff_role AS ENUM ('owner','manager','barber','assistant','reception');
  END IF;
END $$;

-- 4) Create shop_staff table
CREATE TABLE IF NOT EXISTS "shop_staff" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" integer NOT NULL REFERENCES "barber_shops"("id") ON DELETE CASCADE,
  "auth_user_id" uuid NOT NULL REFERENCES "users"("auth_user_id") ON DELETE CASCADE,
  "role" staff_role NOT NULL DEFAULT 'barber',
  "is_active" boolean NOT NULL DEFAULT true,
  "tenant_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_staff_shop_auth_unique" ON "shop_staff" ("shop_id","auth_user_id");
CREATE INDEX IF NOT EXISTS "shop_staff_tenant_idx" ON "shop_staff" ("tenant_id");

-- 5) Create staff_hours table
CREATE TABLE IF NOT EXISTS "staff_hours" (
  "id" serial PRIMARY KEY,
  "staff_id" uuid NOT NULL REFERENCES "shop_staff"("id") ON DELETE CASCADE,
  "weekday" integer NOT NULL,
  "open_time" time NOT NULL,
  "close_time" time NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "tenant_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_hours_unique" ON "staff_hours" ("staff_id","weekday","open_time","close_time");
CREATE INDEX IF NOT EXISTS "staff_hours_tenant_idx" ON "staff_hours" ("tenant_id");

-- 6) Create staff_leaves table
CREATE TABLE IF NOT EXISTS "staff_leaves" (
  "id" serial PRIMARY KEY,
  "staff_id" uuid NOT NULL REFERENCES "shop_staff"("id") ON DELETE CASCADE,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "full_day" boolean NOT NULL DEFAULT true,
  "start_time" time,
  "end_time" time,
  "reason" text,
  "tenant_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "staff_leaves_tenant_idx" ON "staff_leaves" ("tenant_id");

-- 7) Optional: add foreign key for bookings.barber_id -> shop_staff.id (if column exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'bookings_barber_fk'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_barber_fk"
      FOREIGN KEY ("barber_id") REFERENCES "shop_staff"("id") ON DELETE SET NULL;
  END IF;
END $$;