CREATE TABLE IF NOT EXISTS "barber_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_shop_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "barber_shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_shop_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "barber_comments" ADD CONSTRAINT "barber_comments_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
-- Skipping FK to users.id due to possible type mismatch (uuid/integer) on remote DB
-- ALTER TABLE "barber_comments" ADD CONSTRAINT "barber_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "services" ADD CONSTRAINT "services_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;