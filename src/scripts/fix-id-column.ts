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

async function fixIdColumn() {
  const client = await pool.connect()
  
  try {
    console.log('Fixing id column type from INTEGER to UUID...')
    
    // Check current id column type
    const idResult = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops' AND column_name = 'id'
    `)
    
    const currentType = idResult.rows[0]?.data_type
    console.log(`Current id column type: ${currentType}`)
    
    if (currentType === 'integer') {
      console.log('Converting id column from INTEGER to UUID...')
      
      // First, let's check if there are any existing records
      const countResult = await client.query('SELECT COUNT(*) as count FROM barber_shops')
      const recordCount = parseInt(countResult.rows[0].count)
      
      console.log(`Found ${recordCount} existing records`)
      
      if (recordCount > 0) {
        // If there are records, we need to handle the conversion carefully
        console.log('Backing up existing data...')
        await client.query('CREATE TABLE barber_shops_backup AS SELECT * FROM barber_shops')
        
        // Drop the existing table
        await client.query('DROP TABLE barber_shops')
        
        // Create new table with UUID id
        await client.query(`
          CREATE TABLE barber_shops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(200) NOT NULL,
            address TEXT NOT NULL,
            phone VARCHAR(32) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
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
            owner_user_id INTEGER,
            tenant_id TEXT NOT NULL DEFAULT 'kuaforun',
            gender TEXT DEFAULT 'unisex'
          )
        `)
        
        // Insert data back with new UUIDs
        await client.query(`
          INSERT INTO barber_shops (
            name, address, phone, created_at, updated_at, 
            google_place_id, formatted_address, email, website, 
            latitude, longitude, open_now, opening_hours, types, 
            serpapi_raw, google_rating, google_user_ratings_total, 
            price_level, owner_user_id, tenant_id, gender
          )
          SELECT 
            name, address, phone, created_at, updated_at, 
            google_place_id, formatted_address, email, website, 
            latitude, longitude, open_now, opening_hours, types, 
            serpapi_raw, google_rating, google_user_ratings_total, 
            price_level, owner_user_id, tenant_id, gender
          FROM barber_shops_backup
        `)
        
        // Drop backup table
        await client.query('DROP TABLE barber_shops_backup')
        
      } else {
        // If no records, we can simply alter the column
        console.log('No existing records, altering column type...')
        
        // For UUID conversion, we need to handle it differently
        await client.query(`
          ALTER TABLE barber_shops 
          ALTER COLUMN id TYPE UUID USING gen_random_uuid()
        `)
      }
      
      // Create index
      await client.query('CREATE INDEX IF NOT EXISTS barber_shops_tenant_idx ON barber_shops(tenant_id)')
      
      console.log('Id column conversion completed successfully!')
      
    } else if (currentType === 'uuid') {
      console.log('Id column is already UUID type')
    } else {
      console.log(`Unexpected id column type: ${currentType}`)
    }
    
    // Verify the new structure
    const newResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops'
      ORDER BY ordinal_position
    `)
    
    console.log('\nUpdated barber_shops structure:')
    newResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`)
    })
    
  } catch (error) {
    console.error('Id column fix failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixIdColumn().catch(console.error)