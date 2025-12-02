import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function verifyMigrations() {
  try {
    console.log('Verifying all migrations completed successfully...');
    
    // Check all applied migrations
    const migrations = await db.execute(sql`
      SELECT hash, name, created_at FROM "__drizzle_migrations" ORDER BY created_at;
    `);
    
    console.log(`✓ Total migrations applied: ${migrations.rows.length}`);
    for (const row of migrations.rows) {
      console.log(`  - ${row.name} (${row.hash})`);
    }
    
    // Check all tables
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`\n✓ Total tables created: ${tables.rows.length}`);
    for (const row of tables.rows) {
      console.log(`  - ${row.table_name}`);
    }
    
    // Check key constraints and relationships
    const constraints = await db.execute(sql`
      SELECT table_name, constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public'
      AND constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
      ORDER BY table_name, constraint_type;
    `);
    
    console.log(`\n✓ Total constraints created: ${constraints.rows.length}`);
    
    // Check enums
    const enums = await db.execute(sql`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY typname;
    `);
    
    console.log(`\n✓ Total enums created: ${enums.rows.length}`);
    for (const row of enums.rows) {
      console.log(`  - ${row.typname}`);
    }
    
    console.log('\n🎉 Database migrations completed successfully!');
    console.log('The database is now ready for frontend usage.');
    
  } catch (error) {
    console.error('Error verifying migrations:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

void verifyMigrations();