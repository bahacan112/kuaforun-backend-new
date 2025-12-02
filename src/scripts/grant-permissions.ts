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

async function grantPermissions() {
  const client = await pool.connect()
  
  try {
    console.log('Granting permissions for barber_shops table...')
    
    // Grant permissions to anon and authenticated roles
    await client.query(`GRANT SELECT ON barber_shops TO anon`)
    await client.query(`GRANT ALL PRIVILEGES ON barber_shops TO authenticated`)
    
    // Check current permissions after granting
    const permissionsResult = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'barber_shops' AND grantee IN ('anon', 'authenticated')
      ORDER BY grantee, privilege_type
    `)
    
    console.log('\nUpdated permissions for anon and authenticated roles:')
    permissionsResult.rows.forEach(row => {
      console.log(`  ${row.grantee}: ${row.privilege_type}`)
    })
    
    console.log('\nPermissions granted successfully!')
    
  } catch (error) {
    console.error('Permission granting failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

grantPermissions().catch(console.error)