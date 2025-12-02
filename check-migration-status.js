import { db, pool } from './src/db/index.ts';

async function checkMigrationStatus() {
  try {
    console.log('🔍 Checking current database schema...');
    
    // Tabloları kontrol et
    const tables = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Current tables:');
    if (tables.rows && tables.rows.length > 0) {
      tables.rows.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      
      // Eğer tablolar varsa, bookings ve barber_shops tablolarının yapısını kontrol et
      const hasBookings = tables.rows.some(t => t.table_name === 'bookings');
      const hasBarberShops = tables.rows.some(t => t.table_name === 'barber_shops');
      
      if (hasBookings) {
        console.log('\n🔍 Bookings table structure:');
        const bookingColumns = await db.execute(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'bookings' 
          ORDER BY ordinal_position
        `);
        bookingColumns.rows.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
      }
      
      if (hasBarberShops) {
        console.log('\n🔍 Barber shops table structure:');
        const shopColumns = await db.execute(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'barber_shops' 
          ORDER BY ordinal_position
        `);
        shopColumns.rows.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
      }
    } else {
      console.log('   No tables found');
    }
    
    // Drizzle migration durumunu kontrol et
    console.log('\n🔍 Checking migration status...');
    try {
      const drizzleTables = await db.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'drizzle'
      `);
      
      if (drizzleTables.rows && drizzleTables.rows.length > 0) {
        console.log('✅ Drizzle schema exists');
        
        const migrations = await db.execute(`
          SELECT * FROM drizzle.__drizzle_migrations 
          ORDER BY created_at
        `);
        console.log(`📜 Applied migrations: ${migrations.rows.length}`);
        migrations.rows.forEach(m => {
          console.log(`   - ${m.hash} (${m.created_at})`);
        });
      } else {
        console.log('ℹ️  No drizzle schema found - fresh database');
      }
    } catch (err) {
      console.log('ℹ️  No drizzle schema found - fresh database');
    }
    
    await pool.end();
    console.log('\n✅ Database check completed');
    
  } catch (err) {
    console.error('❌ Database check failed:', err.message);
    await pool.end();
  }
}

checkMigrationStatus();