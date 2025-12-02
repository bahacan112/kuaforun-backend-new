import { Pool } from 'pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL not found in environment')
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: false
})

async function recreateBarberShopsTable() {
  const client = await pool.connect()
  
  try {
    console.log('Recreating barber_shops table with correct schema...')
    
    // Drop existing table
    await client.query('DROP TABLE IF EXISTS barber_shops')
    console.log('Dropped existing barber_shops table')
    
    // Create new table with correct schema matching Drizzle
    await client.query(`
      CREATE TABLE barber_shops (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        address TEXT NOT NULL,
        phone VARCHAR(32) NOT NULL,
        gender TEXT NOT NULL DEFAULT 'unisex',
        tenant_id TEXT NOT NULL DEFAULT 'kuaforun',
        owner_user_id UUID,
        google_place_id TEXT,
        formatted_address TEXT,
        email VARCHAR(320),
        website TEXT,
        latitude NUMERIC(9,6),
        longitude NUMERIC(9,6),
        open_now BOOLEAN,
        opening_hours JSONB,
        types TEXT[],
        serpapi_raw JSONB,
        google_rating NUMERIC(3,2),
        google_user_ratings_total INTEGER,
        price_level INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )
    `)
    console.log('Created new barber_shops table with correct schema')
    
    // Create tenant index
    await client.query('CREATE INDEX barber_shops_tenant_idx ON barber_shops(tenant_id)')
    console.log('Created tenant index')
    
    // Verify the new structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops'
      ORDER BY ordinal_position
    `)
    
    console.log('\nNew barber_shops structure:')
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`)
    })
    
    // Test a simple query
    console.log('\nTesting query...')
    const testResult = await client.query('SELECT COUNT(*) as count FROM barber_shops WHERE tenant_id = $1', ['kuaforun'])
    console.log(`Query successful! Found ${testResult.rows[0].count} rows`)
    
    console.log('\nTable recreation completed successfully!')
    
  } catch (error) {
    console.error('Table recreation failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

recreateBarberShopsTable().catch(console.error)