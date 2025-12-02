import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function fixUsersTable() {
  try {
    console.log('Checking users table...');
    
    // Check if users table exists
    const usersExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (usersExists.rows[0]?.exists) {
      console.log('Users table exists, checking columns...');
      
      // Check if tenant_id column exists
      const tenantIdExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'tenant_id'
        );
      `);
      
      if (!tenantIdExists.rows[0]?.exists) {
        console.log('tenant_id column missing, adding it...');
        await db.execute(sql`ALTER TABLE "users" ADD COLUMN "tenant_id" text;`);
        console.log('Added tenant_id column (nullable)');
        await db.execute(sql`UPDATE "users" SET "tenant_id" = 'kuaforun' WHERE "tenant_id" IS NULL;`);
        console.log('Filled tenant_id with default tenant');
        await db.execute(sql`ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;`);
        console.log('Set tenant_id to NOT NULL');
      } else {
        console.log('tenant_id column already exists');
      }
      
      // Check other problematic columns
      const columns = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users';
      `);
      
      console.log('Current users table columns:');
      for (const row of columns.rows) {
        console.log(`  ${row.column_name}`);
      }
    } else {
      console.log('Users table does not exist');
    }
    
    console.log('Fix completed!');
    
  } catch (error) {
    console.error('Error fixing users table:', error);
  } finally {
    process.exit(0);
  }
}

void fixUsersTable();