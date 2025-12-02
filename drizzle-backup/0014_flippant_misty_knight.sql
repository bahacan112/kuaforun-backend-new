CREATE TABLE "user_favorite_shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_auth_id" uuid NOT NULL,
	"shop_id" integer NOT NULL,
	"tenant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_favorite_shops" ADD CONSTRAINT "user_favorite_shops_shop_id_barber_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."barber_shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_favorite_shops_user_shop_unique" ON "user_favorite_shops" USING btree ("tenant_id","user_auth_id","shop_id");--> statement-breakpoint
CREATE INDEX "user_favorite_shops_user_idx" ON "user_favorite_shops" USING btree ("tenant_id","user_auth_id");