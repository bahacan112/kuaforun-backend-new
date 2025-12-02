ALTER TABLE "barber_photos" ADD COLUMN IF NOT EXISTS "storage_key" text;--> statement-breakpoint
ALTER TABLE "barber_photos" ADD COLUMN IF NOT EXISTS "storage_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "barber_photos_storage_key_unique" ON "barber_photos" USING btree ("storage_key");