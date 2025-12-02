DO $$ BEGIN
  ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'salon_owner';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;