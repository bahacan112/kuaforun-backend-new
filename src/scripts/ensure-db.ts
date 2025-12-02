import { Pool } from 'pg'
import { env } from '../core/env'

function getDbName(urlStr: string) {
  const u = new URL(urlStr)
  return u.pathname.replace('/', '')
}

function getServerUrl(urlStr: string) {
  const u = new URL(urlStr)
  u.pathname = '/postgres'
  return u.toString()
}

async function main() {
  const baseUrl = env.DATABASE_URL
  const dbName = getDbName(baseUrl)
  const serverUrl = getServerUrl(baseUrl)

  const pool = new Pool({ connectionString: serverUrl })
  try {
    const res = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    const exists = res.rowCount && res.rowCount > 0
    if (exists) {
      console.log(`Database '${dbName}' already exists.`)
    } else {
      await pool.query(`CREATE DATABASE "${dbName}"`)
      console.log(`Database '${dbName}' created.`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Ensure DB failed:', err)
  process.exit(1)
})