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

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('Running tenant_id migration for barber_shops...')
    
    // Check if tenant_id column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'barber_shops' AND column_name = 'tenant_id'
    `)
    
    if (checkResult.rows.length > 0) {
      console.log('tenant_id column already exists in barber_shops table')
      return
    }
    
    // Add tenant_id column
    await client.query(`
      ALTER TABLE barber_shops ADD COLUMN tenant_id TEXT DEFAULT 'kuaforun'
    `)
    
    // Update existing records
    await client.query(`
      UPDATE barber_shops SET tenant_id = 'kuaforun' WHERE tenant_id IS NULL
    `)
    
    // Make column NOT NULL
    await client.query(`
      ALTER TABLE barber_shops ALTER COLUMN tenant_id SET NOT NULL
    `)
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS barber_shops_tenant_idx ON barber_shops(tenant_id)
    `)
    
    console.log('Migration completed successfully!')
    
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration().catch(console.error)