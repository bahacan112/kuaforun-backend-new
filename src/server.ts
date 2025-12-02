import { serve } from '@hono/node-server'
import app from './app'
import { env } from './core/env'
import { pool } from './db/index'

const port = env.PORT

// Debug: Database connection info
console.log('=== DATABASE DEBUG INFO ===')
console.log('DATABASE_URL from env:', env.DATABASE_URL)
console.log('Pool config:', {
  host: pool.options?.host,
  port: pool.options?.port,
  database: pool.options?.database,
  user: pool.options?.user ? '****' : undefined
})

serve({ fetch: app.fetch, port })

console.log(`🚀 Server running at http://localhost:${port}`)

// Monolitik yapı - event bus kullanmıyoruz
// Kullanıcı oluşturma işlemi direkt servislerde yapılacak