import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function checkMigrationStatus() {
  try {
    console.log('Checking migration status...');
    
    // Check applied migrations
    const migrations = await db.execute(sql`
      SELECT * FROM "__drizzle_migrations" ORDER BY created_at;
    `);
    
    console.log('Applied migrations:');
    for (const row of migrations.rows) {
      console.log(`  ${row.hash} - ${row.name}`);
    }
    
    // Check if shop_staff table exists
    const shopStaffExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'shop_staff'
      );
    `);
    
    console.log(`\nshop_staff table exists: ${shopStaffExists.rows[0]?.exists}`);
    
    // Check if staff_role enum exists
    const staffRoleExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_type 
        WHERE typname = 'staff_role' 
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      );
    `);
    
    console.log(`staff_role enum exists: ${staffRoleExists.rows[0]?.exists}`);
    
  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    process.exit(0);
  }
}

void checkMigrationStatus();