import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as _migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';
import fs from 'fs';
import path from 'path';

const db = drizzle(pool);

async function manualMigrate() {
  try {
    console.log('Starting manual migration process...');
    
    // Create drizzle migrations table manually
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        hash text PRIMARY KEY,
        created_at bigint NOT NULL,
        folder text NOT NULL,
        name text NOT NULL
      )
    `);
    
    console.log('Created drizzle migrations table');
    
    // Read all migration files
    const migrationsDir = path.join(process.cwd(), 'drizzle');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${files.length} migration files`);
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract hash from filename (before the underscore)
      const hash = file.split('_')[0];
      const name = file.replace('.sql', '');
      
      console.log(`\nProcessing migration: ${file}`);
      
      // Check if this migration has already been applied
      const existing = await db.execute(sql`
        SELECT hash FROM "__drizzle_migrations" WHERE hash = ${hash}
      `);
      
      if (existing.rows.length > 0) {
        console.log(`  Skipping ${file} - already applied`);
        continue;
      }
      
      try {
        // Split the migration into individual statements
        const statements = content.split('--> statement-breakpoint')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);
        
        console.log(`  Executing ${statements.length} statements...`);
        
        for (const statement of statements) {
          try {
            await db.execute(sql.raw(statement));
          } catch (stmtError) {
            const msg = stmtError instanceof Error ? stmtError.message : undefined;
            if (msg?.includes('already exists') || msg?.includes('duplicate_object')) {
              console.log(`    Statement skipped (already exists): ${statement.substring(0, 50)}...`);
            } else {
              throw stmtError;
            }
          }
        }
        
        // Record this migration as applied
        await db.execute(sql`
          INSERT INTO "__drizzle_migrations" (hash, created_at, folder, name)
          VALUES (${hash}, ${Date.now()}, 'drizzle', ${name})
        `);
        
        console.log(`  ✓ Migration ${file} completed successfully`);
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Migration ${file} failed:`, msg);
        throw error;
      }
    }
    
    console.log('\nAll migrations completed successfully!');
    
  } catch (error) {
    console.error('Manual migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

void manualMigrate();