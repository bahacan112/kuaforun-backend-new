import { Pool } from 'pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL not found in environment')
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: false,
})

async function main() {
  const client = await pool.connect()
  try {
    console.log('Checking enum values for user_role...')
    const res = await client.query(`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype ORDER BY enumsortorder;`)
    console.log('user_role values:', res.rows.map(r => r.enumlabel))
  } catch (err) {
    console.error('Enum check failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)