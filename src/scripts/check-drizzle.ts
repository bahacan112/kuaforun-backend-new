import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function checkDrizzleMigrations() {
  try {
    console.log('Checking drizzle migrations table...');
    
    // Check if drizzle migrations table exists
    const migrationsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      );
    `).catch(() => ({ rows: [{ exists: false }] }));
    
    if (migrationsExists.rows[0]?.exists) {
      console.log('Drizzle migrations table exists');
      
      const migrations = await db.execute(sql`
        SELECT * FROM "__drizzle_migrations" ORDER BY created_at;
      `);
      
      console.log('Applied migrations:');
      for (const row of migrations.rows) {
        console.log(`  ${row.hash} - ${row.created_at}`);
        console.log(`    Folder: ${row.folder}`);
        console.log(`    Name: ${row.name}`);
      }
    } else {
      console.log('Drizzle migrations table does not exist');
    }
    
    // Let's also check what happens when we try to create the users table manually
    console.log('\nTrying to understand the migration issue...');
    
    // Check if there's any partial state
    const sequences = await db.execute(sql`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `).catch(() => ({ rows: [] }));
    
    if (sequences.rows.length > 0) {
      console.log('Found sequences:');
      for (const row of sequences.rows) {
        console.log(`  ${row.sequence_name}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking drizzle migrations:', error);
  } finally {
    process.exit(0);
  }
}

void checkDrizzleMigrations();