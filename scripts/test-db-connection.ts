import { drizzle as _drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as _schema from '../src/db/schema';
import { sql as _sql } from 'drizzle-orm';

// Load environment variables
import { config } from 'dotenv';
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function testConnection() {
  try {
    // Create a connection for testing
    const testClient = postgres(connectionString);
    
    // Test the connection
    const result = await testClient`SELECT version()`;
    console.log('✅ Database connection successful');
    console.log('PostgreSQL Version:', result[0].version);
    
    // List all tables
    const tables = await testClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('\n📋 Current tables in database:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check current column types for key tables
    console.log('\n🔍 Checking current ID column types:');
    
    for (const table of tables) {
      const columns = await testClient`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${table.table_name}
        AND column_name = 'id'
      `;
      
      if (columns.length > 0) {
        const column = columns[0];
        console.log(`  ${table.table_name}.id: ${column.data_type} (default: ${column.column_default || 'none'})`);
      }
    }
    
    await testClient.end();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

void testConnection();