import { pool } from '../db'

async function main() {
  const res = await pool.query(
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'users'
     ORDER BY ordinal_position`
  )
  console.log('users table columns:')
  for (const row of res.rows) {
    console.log(row)
  }
  await pool.end()
}

main().catch((err) => {
  console.error('Debug failed:', err)
  process.exit(1)
})