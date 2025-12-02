import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { pool } from '../db/index';

const db = drizzle(pool);

async function comprehensiveReset() {
  try {
    console.log('Starting comprehensive database reset...');
    
    // Drop all existing tables and types in the correct order
    const dropStatements = [
      'DROP TABLE IF EXISTS "user_favorite_shops" CASCADE',
      'DROP TABLE IF EXISTS "user_favorite_barbers" CASCADE',
      'DROP TABLE IF EXISTS "shop_staff" CASCADE',
      'DROP TABLE IF EXISTS "staff_hours" CASCADE',
      'DROP TABLE IF EXISTS "staff_leaves" CASCADE',
      'DROP TABLE IF EXISTS "booking_services" CASCADE',
      'DROP TABLE IF EXISTS "bookings" CASCADE',
      'DROP TABLE IF EXISTS "barber_comment_replies" CASCADE',
      'DROP TABLE IF EXISTS "barber_comments" CASCADE',
      'DROP TABLE IF EXISTS "user_refresh_tokens" CASCADE',
      'DROP TABLE IF EXISTS "services" CASCADE',
      'DROP TABLE IF EXISTS "barber_shops" CASCADE',
      'DROP TABLE IF EXISTS "users" CASCADE',
      'DROP TYPE IF EXISTS "booking_status" CASCADE',
      'DROP TYPE IF EXISTS "user_role" CASCADE',
      'DROP TYPE IF EXISTS "shop_gender" CASCADE',
      'DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE'
    ];
    
    for (const statement of dropStatements) {
      try {
        console.log(`Executing: ${statement}`);
        await db.execute(sql.raw(statement));
      } catch {
        console.log(`Statement failed (might not exist): ${statement}`);
      }
    }
    
    console.log('Database cleaned. Running migrations...');
    
    // Run all migrations
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('All migrations completed successfully!');
    
  } catch (error) {
    console.error('Error during comprehensive reset:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

void comprehensiveReset();