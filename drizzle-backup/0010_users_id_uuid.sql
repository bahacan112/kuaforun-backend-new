-- Convert users.id from serial/integer to UUID
-- Requires pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop foreign keys referencing users(id) to allow type change
DO $$ BEGIN
  ALTER TABLE "user_refresh_tokens" DROP CONSTRAINT IF EXISTS "user_refresh_tokens_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "barber_shops" DROP CONSTRAINT IF EXISTS "barber_shops_owner_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "barber_comment_replies" DROP CONSTRAINT IF EXISTS "barber_comment_replies_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Alter users.id to UUID, generating new UUIDs for existing rows
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "id" TYPE uuid USING gen_random_uuid();
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Recreate foreign keys now that types match
DO $$ BEGIN
  ALTER TABLE "user_refresh_tokens" ADD CONSTRAINT "user_refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "barber_shops" ADD CONSTRAINT "barber_shops_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "barber_comment_replies" ADD CONSTRAINT "barber_comment_replies_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;