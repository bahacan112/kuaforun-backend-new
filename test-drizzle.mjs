import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './src/db/schema.ts'
import { eq, and } from 'drizzle-orm'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const db = drizzle(pool, { schema })

async function testDrizzleQuery() {
  try {
    console.log('Testing Drizzle query...')
    const result = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, 'test@example.com'), eq(schema.users.tenantId, 'kuaforun')))
      .limit(1)
    
    console.log('✅ Drizzle query successful, found', result.length, 'rows')
    if (result.length > 0) {
      console.log('First row ID:', result[0].id, 'type:', typeof result[0].id)
    }
  } catch (error) {
    console.error('❌ Drizzle query failed:', error.message)
    console.error('Error code:', error.code)
    console.error('Error position:', error.position)
    console.error('Full error:', error)
  } finally {
    await pool.end()
  }
}

testDrizzleQuery()