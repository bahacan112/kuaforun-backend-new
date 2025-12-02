-- Add timestamptz columns for start/end timestamps (initially nullable for backfill)
ALTER TABLE "bookings" ADD COLUMN "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint

-- Backfill existing rows using booking_date + start_time/end_time interpreted as UTC
UPDATE "bookings"
SET
  "start_at" = (("booking_date"::timestamp + "start_time") AT TIME ZONE 'UTC'),
  "end_at"   = (("booking_date"::timestamp + "end_time")   AT TIME ZONE 'UTC')
WHERE "start_at" IS NULL OR "end_at" IS NULL;--> statement-breakpoint

-- Enforce NOT NULL after backfill
ALTER TABLE "bookings" ALTER COLUMN "start_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "end_at" SET NOT NULL;