CREATE TYPE "public"."staff_role" AS ENUM('owner', 'manager', 'barber', 'assistant', 'reception');--> statement-breakpoint
CREATE TABLE "shop_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" integer NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"role" "staff_role" DEFAULT 'barber' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"open_time" time NOT NULL,
	"close_time" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_leaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"full_day" boolean DEFAULT true NOT NULL,
	"start_time" time,
	"end_time" time,
	"reason" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "booking_service_unique";--> statement-breakpoint
ALTER TABLE "booking_services" ADD COLUMN "tenant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "tenant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_shop_id_barber_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_auth_user_id_users_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."users"("auth_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_hours" ADD CONSTRAINT "staff_hours_staff_id_shop_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_shop_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_staff_shop_auth_unique" ON "shop_staff" USING btree ("shop_id","auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_hours_unique" ON "staff_hours" USING btree ("staff_id","weekday","open_time","close_time");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_tenant_key_unique" ON "system_settings" USING btree ("tenant_id","key");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_shop_staff_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."shop_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_service_unique" ON "booking_services" USING btree ("booking_id","service_id","tenant_id");