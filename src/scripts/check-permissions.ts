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

async function checkPermissions() {
  const client = await pool.connect()
  
  try {
    console.log('Checking barber_shops table permissions...')
    
    // Check table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops'
      ORDER BY ordinal_position
    `)
    
    console.log('Barber shops table structure:')
    structureResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable} ${row.column_default || ''}`)
    })
    
    // Check permissions
    const permissionsResult = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'barber_shops'
      ORDER BY grantee, privilege_type
    `)
    
    console.log('\nBarber shops table permissions:')
    permissionsResult.rows.forEach(row => {
      console.log(`  ${row.grantee}: ${row.privilege_type}`)
    })
    
    // Test a simple query
    console.log('\nTesting simple query...')
    const testResult = await client.query('SELECT COUNT(*) as count FROM barber_shops WHERE tenant_id = $1', ['kuaforun'])
    console.log(`Query result: ${testResult.rows[0].count} rows with tenant_id = 'kuaforun'`)
    
    console.log('\nPermission check completed successfully!')
    
  } catch (error) {
    console.error('Permission check failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

checkPermissions().catch(console.error)