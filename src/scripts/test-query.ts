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

async function testQuery() {
  const client = await pool.connect()
  
  try {
    console.log('Testing the exact query from the shops endpoint...')
    
    // Test the exact same query that the application runs
    const query = `
      SELECT id, name, address, phone, gender, tenant_id, owner_user_id, 
             google_place_id, formatted_address, email, website, latitude, 
             longitude, open_now, opening_hours, types, serpapi_raw, 
             google_rating, google_user_ratings_total, price_level, 
             created_at, updated_at 
      FROM barber_shops 
      WHERE tenant_id = $1
    `
    
    console.log(`Running query: ${query}`)
    console.log(`With parameter: kuaforun`)
    
    const result = await client.query(query, ['kuaforun'])
    console.log(`Query successful! Found ${result.rows.length} rows`)
    
    if (result.rows.length > 0) {
      console.log('First row:', result.rows[0])
    }
    
  } catch (error) {
    console.error('Query failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

testQuery().catch(console.error)