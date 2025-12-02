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

async function checkActualColumns() {
  const client = await pool.connect()
  
  try {
    console.log('Checking actual columns in barber_shops table...')
    
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops'
      ORDER BY ordinal_position
    `)
    
    console.log('Actual columns in barber_shops table:')
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable} ${row.column_default || ''}`)
    })
    
    // Test a query with only existing columns
    const existingColumns = result.rows.map(row => row.column_name).join(', ')
    console.log(`\nExisting columns: ${existingColumns}`)
    
    const testQuery = `SELECT ${existingColumns} FROM barber_shops WHERE tenant_id = $1`
    console.log(`\nTesting query: ${testQuery}`)
    
    const testResult = await client.query(testQuery, ['kuaforun'])
    console.log(`Query successful! Found ${testResult.rows.length} rows`)
    
  } catch (error) {
    console.error('Check failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

checkActualColumns().catch(console.error)