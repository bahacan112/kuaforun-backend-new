CREATE TABLE IF NOT EXISTS "service_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"gender" "shop_gender" NOT NULL,
	"default_price" numeric(10,2) NOT NULL,
	"default_duration_minutes" integer NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "service_template_id" integer;
  ALTER TABLE "services" ADD CONSTRAINT "services_service_template_id_service_templates_id_fk" FOREIGN KEY ("service_template_id") REFERENCES "service_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;