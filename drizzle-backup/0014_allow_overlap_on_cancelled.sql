-- Adjust overlap constraint to ignore cancelled bookings (so cancelled slots can be rebooked)
-- This aligns with RBAC tests expecting rebooking after cancellation.

-- Ensure btree_gist extension is available (safe to repeat)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop previous overlap constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bookings_no_overlap'
      AND table_name = 'bookings'
  ) THEN
    ALTER TABLE "bookings" DROP CONSTRAINT "bookings_no_overlap";
  END IF;
END $$;

-- Recreate overlap constraint excluding cancelled bookings
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    "barber_id" WITH =,
    "booking_date" WITH =,
    tsrange(
      "booking_date"::timestamp + "start_time",
      "booking_date"::timestamp + "end_time",
      '[)'
    ) WITH &&
  )
  WHERE ("barber_id" IS NOT NULL AND "status" <> 'cancelled'::booking_status);