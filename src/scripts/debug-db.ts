import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.DATABASE_URL;

console.log('Database URL:', databaseUrl?.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: false
});

async function debugDatabase() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Checking current database...');
    const dbResult = await client.query('SELECT current_database()');
    console.log('Current database:', dbResult.rows[0].current_database);
    
    console.log('Checking for users table...');
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    `);
    
    if (tableResult.rows.length > 0) {
      console.log('Users table exists!');
      
      const columnResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'tenant_id'
      `);
      
      if (columnResult.rows.length > 0) {
        console.log('tenant_id column exists!');
      } else {
        console.log('tenant_id column missing!');
      }
    } else {
      console.log('Users table does not exist');
    }
    
    console.log('Checking all tables...');
    const allTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('Tables found:');
    for (const row of allTables.rows) {
      console.log(`  ${row.table_name}`);
    }
    
    client.release();
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

void debugDatabase();