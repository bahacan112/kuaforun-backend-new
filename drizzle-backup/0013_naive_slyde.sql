CREATE TABLE "user_favorite_barbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_auth_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_favorite_barbers" ADD CONSTRAINT "user_favorite_barbers_staff_id_shop_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_favorite_barbers_user_staff_unique" ON "user_favorite_barbers" USING btree ("tenant_id","user_auth_id","staff_id");--> statement-breakpoint
CREATE INDEX "user_favorite_barbers_user_idx" ON "user_favorite_barbers" USING btree ("tenant_id","user_auth_id");