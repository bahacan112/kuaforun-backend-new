import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function checkDatabase() {
  try {
    console.log('Checking current database state...');
    
    // Check if users table exists and has tenant_id column
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('Users table columns:');
    for (const row of result.rows) {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    }
    
    // Check all tables
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('\nAll tables:');
    for (const row of tables.rows) {
      console.log(`  ${row.table_name}`);
    }
    
    // Check drizzle migrations
    const migrations = await db.execute(sql`
      SELECT * FROM "__drizzle_migrations" ORDER BY created_at;
    `).catch(() => ({ rows: [] }));
    
    console.log('\nApplied migrations:');
    for (const row of migrations.rows) {
      console.log(`  ${row.hash} - ${row.created_at}`);
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

void checkDatabase();