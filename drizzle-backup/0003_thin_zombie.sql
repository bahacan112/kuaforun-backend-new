CREATE TABLE IF NOT EXISTS "barber_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_shop_id" integer NOT NULL,
	"weekday" integer NOT NULL,
	"open_minutes" integer NOT NULL,
	"close_minutes" integer NOT NULL,
	"open_24h" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "barber_hours" ADD CONSTRAINT "barber_hours_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "barber_hours_unique" ON "barber_hours" USING btree ("barber_shop_id","weekday","open_minutes","close_minutes");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "barber_photos_shop_photo_unique" ON "barber_photos" USING btree ("barber_shop_id","photo_reference");