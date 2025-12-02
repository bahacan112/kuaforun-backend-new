DO $$ BEGIN
  CREATE TYPE "public"."review_source" AS ENUM('google', 'serpapi', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "barber_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_shop_id" integer NOT NULL,
	"photo_reference" text NOT NULL,
	"width" integer,
	"height" integer,
	"attributions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "barber_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_shop_id" integer NOT NULL,
	"source" "review_source" DEFAULT 'google' NOT NULL,
	"external_review_id" text,
	"author_name" text,
	"author_url" text,
	"profile_photo_url" text,
	"rating" integer NOT NULL,
	"text" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "barber_comments" DROP CONSTRAINT "barber_comments_user_id_users_id_fk";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "barber_comments" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "google_place_id" text;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "formatted_address" text;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "email" varchar(320);--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "website" text;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "open_now" boolean;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "types" text[];--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "serpapi_raw" jsonb;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "google_rating" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "google_user_ratings_total" integer;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "price_level" integer;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "barber_photos" ADD CONSTRAINT "barber_photos_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "barber_reviews" ADD CONSTRAINT "barber_reviews_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "barber_reviews_external_unique" ON "barber_reviews" USING btree ("external_review_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "barber_shops_place_id_unique" ON "barber_shops" USING btree ("google_place_id");