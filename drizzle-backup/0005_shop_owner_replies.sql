-- Add owner_user_id to barber_shops to associate a shop owner
ALTER TABLE "barber_shops" ADD COLUMN IF NOT EXISTS "owner_user_id" integer;
ALTER TABLE "barber_shops"
  ADD CONSTRAINT IF NOT EXISTS "barber_shops_owner_user_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- Create replies table for shop owner responses to comments
CREATE TABLE IF NOT EXISTS "barber_comment_replies" (
  "id" serial PRIMARY KEY,
  "comment_id" integer NOT NULL REFERENCES "barber_comments"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Ensure a single reply per comment (optional uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS "barber_comment_replies_comment_unique" ON "barber_comment_replies" ("comment_id");