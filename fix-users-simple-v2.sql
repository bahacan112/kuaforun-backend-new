-- Simple fix: Update the users table to use UUID without breaking existing data
-- This approach keeps existing data but makes the schema compatible

-- Step 1: Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Add a new UUID column for auth compatibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uuid uuid DEFAULT gen_random_uuid();

-- Step 3: Update existing records to have auth_uuid
UPDATE users SET auth_uuid = gen_random_uuid() WHERE auth_uuid IS NULL;

-- Step 4: Make auth_uuid unique and not null
ALTER TABLE users ALTER COLUMN auth_uuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_uuid_unique ON users(auth_uuid);

-- Step 5: Update the auth_user_id to use the auth_uuid (as UUID, not text)
UPDATE users SET auth_user_id = auth_uuid WHERE auth_user_id IS NULL;

-- Step 6: Create proper indexes
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);