import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function freshMigrate() {
  try {
    console.log('Starting fresh migration...');
    
    // Try to run migrations without checking previous state
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('Migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    
    // If it fails due to existing columns, let's try to fix the specific migration
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('column "tenant_id" of relation "users" already exists')) {
      console.log('Attempting to fix tenant_id column issue...');
      
      try {
        // Check if users table exists
        const usersExists = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
          );
        `);
        
        if (usersExists.rows[0]?.exists) {
          // Drop the column if it exists
          await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "tenant_id";`);
          console.log('Dropped existing tenant_id column');
          
          // Try migration again
          await migrate(db, { migrationsFolder: 'drizzle' });
          console.log('Migrations completed after fixing tenant_id!');
        }
      } catch (fixError) {
        console.error('Failed to fix tenant_id issue:', fixError);
      }
    }
  } finally {
    process.exit(0);
  }
}

void freshMigrate();