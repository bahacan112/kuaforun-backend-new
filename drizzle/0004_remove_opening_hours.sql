-- Remove legacy opening hours columns from barber_shops
ALTER TABLE IF EXISTS barber_shops
  DROP COLUMN IF EXISTS open_now,
  DROP COLUMN IF EXISTS opening_hours;

