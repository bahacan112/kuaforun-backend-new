-- Add table for refresh tokens
CREATE TABLE IF NOT EXISTS "user_refresh_tokens" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "replaced_by_token_id" text,
  "user_agent" text,
  "ip" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for token id
CREATE UNIQUE INDEX IF NOT EXISTS "user_refresh_tokens_token_id_unique" ON "user_refresh_tokens"("token_id");

-- Helpful index for user queries
CREATE INDEX IF NOT EXISTS "user_refresh_tokens_user_id_idx" ON "user_refresh_tokens"("user_id");