CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'slack');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sending', 'sent', 'delivered', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('google', 'serpapi', 'user');--> statement-breakpoint
CREATE TYPE "public"."shop_gender" AS ENUM('male', 'female', 'unisex');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'manager', 'barber', 'assistant', 'reception');--> statement-breakpoint
CREATE TYPE "public"."user_gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'supervisor', 'barber', 'customer');--> statement-breakpoint
CREATE TABLE "barber_comment_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_comment_reply_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"reply_id" uuid NOT NULL,
	"previous_text" text NOT NULL,
	"edited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_comment_reply_moderations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reply_id" uuid NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"moderator_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_shop_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"open_minutes" integer NOT NULL,
	"close_minutes" integer NOT NULL,
	"open_24h" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_shop_id" uuid NOT NULL,
	"photo_reference" text NOT NULL,
	"width" integer,
	"height" integer,
	"attributions" jsonb,
	"storage_key" text,
	"storage_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_shop_id" uuid NOT NULL,
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
CREATE TABLE "barber_shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(32) NOT NULL,
	"gender" "shop_gender" DEFAULT 'unisex' NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_user_id" uuid,
	"google_place_id" text,
	"formatted_address" text,
	"email" varchar(320),
	"website" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"open_now" boolean,
	"opening_hours" jsonb,
	"types" text[],
	"serpapi_raw" jsonb,
	"google_rating" numeric(3, 2),
	"google_user_ratings_total" integer,
	"price_level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"barber_id" uuid,
	"shop_id" uuid NOT NULL,
	"booking_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"notes" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'main' NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(320) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(32),
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar(16) NOT NULL,
	"service" varchar(64) NOT NULL,
	"tenant_id" text,
	"message" text NOT NULL,
	"context" text,
	"request_id" varchar(64),
	"trace_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'main' NOT NULL,
	"user_id" uuid,
	"to" varchar(320) NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"provider" varchar(64),
	"template_id" varchar(128),
	"subject" varchar(320),
	"payload" jsonb,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"error_code" varchar(64),
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"queued_at" timestamp with time zone DEFAULT now(),
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"request_id" varchar(64),
	"trace_id" varchar(64),
	"correlation_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"gender" "shop_gender" NOT NULL,
	"default_price" numeric(10, 2) NOT NULL,
	"default_duration_minutes" integer NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_shop_id" uuid NOT NULL,
	"service_template_id" uuid,
	"name" varchar(200) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "staff_role" DEFAULT 'barber' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorite_barbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorite_shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"tenant_id" text NOT NULL,
	"email" varchar(320),
	"name" varchar(120),
	"phone" varchar(32),
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"registration_approved_at" timestamp with time zone,
	"gender" text,
	"profile_image_url" text,
	"date_of_birth" timestamp with time zone,
	"bio" text,
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "barber_comment_replies" ADD CONSTRAINT "barber_comment_replies_comment_id_barber_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."barber_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_comment_replies" ADD CONSTRAINT "barber_comment_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_comment_reply_history" ADD CONSTRAINT "barber_comment_reply_history_comment_id_barber_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."barber_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_comment_reply_history" ADD CONSTRAINT "barber_comment_reply_history_reply_id_barber_comment_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."barber_comment_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_comment_reply_moderations" ADD CONSTRAINT "barber_comment_reply_moderations_reply_id_barber_comment_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."barber_comment_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_comments" ADD CONSTRAINT "barber_comments_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_comments" ADD CONSTRAINT "barber_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_hours" ADD CONSTRAINT "barber_hours_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_photos" ADD CONSTRAINT "barber_photos_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_reviews" ADD CONSTRAINT "barber_reviews_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_shops" ADD CONSTRAINT "barber_shops_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_shop_staff_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."shop_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shop_id_barber_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_barber_shop_id_barber_shops_id_fk" FOREIGN KEY ("barber_shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_service_template_id_service_templates_id_fk" FOREIGN KEY ("service_template_id") REFERENCES "public"."service_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_shop_id_barber_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_staff" ADD CONSTRAINT "shop_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_hours" ADD CONSTRAINT "staff_hours_staff_id_shop_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_shop_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_barbers" ADD CONSTRAINT "user_favorite_barbers_staff_id_shop_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_shops" ADD CONSTRAINT "user_favorite_shops_shop_id_barber_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "barber_hours_unique" ON "barber_hours" USING btree ("barber_shop_id","weekday","open_minutes","close_minutes");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_photos_shop_photo_unique" ON "barber_photos" USING btree ("barber_shop_id","photo_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_photos_storage_key_unique" ON "barber_photos" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_reviews_external_unique" ON "barber_reviews" USING btree ("external_review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_shops_place_id_unique" ON "barber_shops" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "barber_shops_tenant_idx" ON "barber_shops" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_service_unique" ON "booking_services" USING btree ("booking_id","service_id","tenant_id");--> statement-breakpoint
CREATE INDEX "bookings_barber_date_start_idx" ON "bookings" USING btree ("tenant_id","barber_id","booking_date","start_time");--> statement-breakpoint
CREATE INDEX "bookings_barber_date_range_idx" ON "bookings" USING btree ("tenant_id","barber_id","booking_date","start_time","end_time");--> statement-breakpoint
CREATE INDEX "in_app_notifications_tenant_idx" ON "in_app_notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "in_app_notifications_user_idx" ON "in_app_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "in_app_notifications_created_idx" ON "in_app_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "in_app_notifications_read_idx" ON "in_app_notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "logs_service_idx" ON "logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "logs_level_idx" ON "logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "logs_created_idx" ON "logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_channel_idx" ON "notifications" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_provider_idx" ON "notifications" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_to_idx" ON "notifications" USING btree ("to");--> statement-breakpoint
CREATE INDEX "notifications_correlation_idx" ON "notifications" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_staff_shop_user_unique" ON "shop_staff" USING btree ("shop_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_hours_unique" ON "staff_hours" USING btree ("staff_id","weekday","open_time","close_time");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_tenant_key_unique" ON "system_settings" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_favorite_barbers_user_staff_unique" ON "user_favorite_barbers" USING btree ("tenant_id","user_id","staff_id");--> statement-breakpoint
CREATE INDEX "user_favorite_barbers_user_idx" ON "user_favorite_barbers" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_favorite_shops_user_shop_unique" ON "user_favorite_shops" USING btree ("tenant_id","user_id","shop_id");--> statement-breakpoint
CREATE INDEX "user_favorite_shops_user_idx" ON "user_favorite_shops" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone");