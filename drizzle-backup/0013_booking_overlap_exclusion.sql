-- Ensure btree_gist extension is available for equality in GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Optional: enforce start_time < end_time
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_time_order" CHECK ("start_time" < "end_time");

-- Prevent overlapping bookings for the same barber on the same date and tenant
-- Using tsrange with half-open interval [start, end)
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
  WHERE ("barber_id" IS NOT NULL);