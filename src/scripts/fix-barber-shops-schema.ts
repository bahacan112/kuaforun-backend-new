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

async function fixBarberShopsSchema() {
  const client = await pool.connect()
  
  try {
    console.log('Fixing barber_shops table schema to match Drizzle...')
    
    // Check current structure
    const currentResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops'
      ORDER BY ordinal_position
    `)
    
    console.log('Current barber_shops structure:')
    currentResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`)
    })
    
    // Add missing columns to match Drizzle schema
    console.log('\nAdding missing columns...')
    
    // Add gender column
    await client.query(`
      ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'unisex'
    `)
    
    // Add missing columns that are in Drizzle schema but not in actual table
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS owner_user_id UUID`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS google_place_id TEXT`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS formatted_address TEXT`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS email VARCHAR(320)`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS website TEXT`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6)`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6)`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS open_now BOOLEAN`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS opening_hours JSONB`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS types TEXT[]`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS serpapi_raw JSONB`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS google_rating NUMERIC(3,2)`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS google_user_ratings_total INTEGER`)
    await client.query(`ALTER TABLE barber_shops ADD COLUMN IF NOT EXISTS price_level INTEGER`)
    
    // Make tenant_id NOT NULL
    await client.query(`ALTER TABLE barber_shops ALTER COLUMN tenant_id SET NOT NULL`)
    
    // Create index
    await client.query(`CREATE INDEX IF NOT EXISTS barber_shops_tenant_idx ON barber_shops(tenant_id)`)
    
    console.log('Schema fix completed successfully!')
    
    // Verify the new structure
    const newResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops'
      ORDER BY ordinal_position
    `)
    
    console.log('\nNew barber_shops structure:')
    newResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`)
    })
    
  } catch (error) {
    console.error('Schema fix failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixBarberShopsSchema().catch(console.error)