-- Update foreign keys referencing users(id) to UUID

-- barber_shops.owner_user_id
DO $$ BEGIN
  ALTER TABLE "barber_shops" DROP CONSTRAINT IF EXISTS "barber_shops_owner_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "barber_shops" DROP CONSTRAINT IF EXISTS "barber_shops_owner_user_fk";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "barber_shops" ALTER COLUMN "owner_user_id" TYPE uuid USING "owner_user_id"::uuid;
DO $$ BEGIN
  ALTER TABLE "barber_shops" ADD CONSTRAINT "barber_shops_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- barber_comment_replies.user_id
DO $$ BEGIN
  ALTER TABLE "barber_comment_replies" DROP CONSTRAINT IF EXISTS "barber_comment_replies_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "barber_comment_replies" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
DO $$ BEGIN
  ALTER TABLE "barber_comment_replies" ADD CONSTRAINT "barber_comment_replies_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;