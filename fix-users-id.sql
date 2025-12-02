-- Fix users table ID type issue
-- This migration converts users.id from integer to uuid

-- Step 1: Add a new uuid column
ALTER TABLE users ADD COLUMN new_id uuid DEFAULT gen_random_uuid();

-- Step 2: Update all existing records to have a uuid
UPDATE users SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- Step 3: Drop the old primary key constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;

-- Step 4: Rename columns
ALTER TABLE users RENAME COLUMN id TO old_id;
ALTER TABLE users RENAME COLUMN new_id TO id;

-- Step 5: Set the new primary key
ALTER TABLE users ALTER COLUMN id SET NOT NULL;
ALTER TABLE users ADD PRIMARY KEY (id);

-- Step 6: Drop the old column
ALTER TABLE users DROP COLUMN old_id;

-- Step 7: Update the auth_user_id references
UPDATE users SET auth_user_id = id WHERE auth_user_id IS NULL;

-- Step 8: Create necessary indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_unique ON users(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);