import { db, pool } from './src/db/index.ts';

async function cleanAndMigrate() {
  try {
    console.log('🧹 Cleaning database...');
    
    // Tüm foreign key constraint'ları kaldır
    const constraints = await db.execute(`
      SELECT conname, conrelid::regclass AS table_name
      FROM pg_constraint 
      WHERE contype = 'f' 
      AND connamespace = 'public'::regnamespace
    `);
    
    for (const constraint of constraints.rows) {
      try {
        await db.execute(`ALTER TABLE "${constraint.table_name}" DROP CONSTRAINT "${constraint.conname}"`);
        console.log(`   ✅ Dropped constraint: ${constraint.conname}`);
      } catch (e) {
        console.log(`   ⚠️  Could not drop constraint: ${constraint.conname}`);
      }
    }
    
    // Tüm tabloları kaldır
    const tables = await db.execute(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    for (const table of tables.rows) {
      try {
        await db.execute(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`);
        console.log(`   ✅ Dropped table: ${table.tablename}`);
      } catch (e) {
        console.log(`   ⚠️  Could not drop table: ${table.tablename}`);
      }
    }
    
    // Drizzle schema'sını temizle
    try {
      await db.execute('DROP SCHEMA IF EXISTS "drizzle" CASCADE');
      console.log('   ✅ Dropped drizzle schema');
    } catch (e) {
      console.log('   ⚠️  Could not drop drizzle schema');
    }
    
    console.log('✅ Database cleaned successfully');
    
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

cleanAndMigrate().catch(console.error);