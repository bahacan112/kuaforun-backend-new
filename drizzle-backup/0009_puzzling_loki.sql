ALTER TABLE "bookings" ALTER COLUMN "shop_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tenant_id" text NOT NULL;