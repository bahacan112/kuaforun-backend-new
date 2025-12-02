import { pool } from '../db'

async function main() {
  const res = await pool.query('SELECT * FROM tenants ORDER BY id LIMIT 50')
  console.log('Tenants:', res.rows)
  await pool.end()
}

main().catch((e) => {
  console.error('List tenants failed:', e)
  process.exit(1)
})