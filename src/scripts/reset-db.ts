import postgres from 'postgres';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

async function resetDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  // Create a connection for running raw SQL
  const sql = postgres(connectionString, { max: 1 });
  
  try {
    console.log('Reading reset schema...');
    const resetSQL = readFileSync(join(process.cwd(), 'src/db/reset-schema.sql'), 'utf8');
    
    console.log('Resetting database...');
    await sql.unsafe(resetSQL);
    
    console.log('Database reset completed successfully!');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

resetDatabase().catch(console.error);