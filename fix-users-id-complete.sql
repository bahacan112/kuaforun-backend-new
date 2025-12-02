-- Fix users table ID type issue with proper foreign key handling
-- This migration converts users.id from integer to uuid

-- Step 1: Drop foreign key constraints that reference users.id
ALTER TABLE barber_comment_replies DROP CONSTRAINT IF EXISTS barber_comment_replies_user_id_fkey;
ALTER TABLE barber_shops DROP CONSTRAINT IF EXISTS barber_shops_owner_user_fk;

-- Step 2: Drop the primary key constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;

-- Step 3: Add a new uuid column
ALTER TABLE users ADD COLUMN new_id uuid DEFAULT gen_random_uuid();

-- Step 4: Update all existing records to have a uuid
UPDATE users SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- Step 5: Rename columns
ALTER TABLE users RENAME COLUMN id TO old_id;
ALTER TABLE users RENAME COLUMN new_id TO id;

-- Step 6: Set the new primary key
ALTER TABLE users ALTER COLUMN id SET NOT NULL;
ALTER TABLE users ADD PRIMARY KEY (id);

-- Step 7: Drop the old column
ALTER TABLE users DROP COLUMN old_id;

-- Step 8: Update the auth_user_id references
UPDATE users SET auth_user_id = id WHERE auth_user_id IS NULL;

-- Step 9: Update foreign key columns to use uuid
-- Update barber_comment_replies.user_id to be uuid
ALTER TABLE barber_comment_replies ADD COLUMN new_user_id uuid;
UPDATE barber_comment_replies SET new_user_id = gen_random_uuid() WHERE new_user_id IS NULL;
ALTER TABLE barber_comment_replies DROP COLUMN user_id;
ALTER TABLE barber_comment_replies RENAME COLUMN new_user_id TO user_id;
ALTER TABLE barber_comment_replies ALTER COLUMN user_id SET NOT NULL;

-- Update barber_shops.owner_user_id to be uuid  
ALTER TABLE barber_shops ADD COLUMN new_owner_user_id uuid;
UPDATE barber_shops SET new_owner_user_id = gen_random_uuid() WHERE new_owner_user_id IS NULL;
ALTER TABLE barber_shops DROP COLUMN owner_user_id;
ALTER TABLE barber_shops RENAME COLUMN new_owner_user_id TO owner_user_id;

-- Step 10: Recreate foreign key constraints
ALTER TABLE barber_comment_replies 
ADD CONSTRAINT barber_comment_replies_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE barber_shops 
ADD CONSTRAINT barber_shops_owner_user_fk 
FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 11: Create necessary indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_unique ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);