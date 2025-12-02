-- Alter user_refresh_tokens.user_id to UUID to match users(id)
-- 1) Drop existing foreign key constraint if any
DO $$ BEGIN
  ALTER TABLE "user_refresh_tokens" DROP CONSTRAINT IF EXISTS "user_refresh_tokens_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 2) Alter column type to uuid
ALTER TABLE "user_refresh_tokens" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

-- 3) Re-add foreign key constraint
DO $$ BEGIN
  ALTER TABLE "user_refresh_tokens" ADD CONSTRAINT "user_refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Ensure index still exists or recreate
DROP INDEX IF EXISTS "user_refresh_tokens_user_id_idx";
CREATE INDEX IF NOT EXISTS "user_refresh_tokens_user_id_idx" ON "user_refresh_tokens"("user_id");