import { db, pool } from './src/db/index.ts';

async function resetAndMigrate() {
  try {
    console.log('🔄 Resetting database and running migrations...');
    
    // Tüm tabloları sil (sırayla, dependency order'a göre)
    console.log('🗑️  Dropping existing tables...');
    
    try { await db.execute('DROP TABLE IF EXISTS "booking_services" CASCADE'); } catch (e) {}
    try { await db.execute('DROP TABLE IF EXISTS "bookings" CASCADE'); } catch (e) {}
    try { await db.execute('DROP TABLE IF EXISTS "services" CASCADE'); } catch (e) {}
    try { await db.execute('DROP TABLE IF EXISTS "barber_comments" CASCADE'); } catch (e) {}
    try { await db.execute('DROP TABLE IF EXISTS "barber_shops" CASCADE'); } catch (e) {}
    
    // Drizzle schema'sını temizle
    try { await db.execute('DROP SCHEMA IF EXISTS "drizzle" CASCADE'); } catch (e) {}
    
    console.log('✅ Database cleaned');
    
    // Şimdi migration'ları çalıştır
    console.log('🚀 Running migrations...');
    
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

resetAndMigrate().catch(console.error);