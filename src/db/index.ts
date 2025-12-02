import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { env } from '../core/env'

const parsePoolConfig = (urlStr: string) => {
  console.log('Input URL string:', urlStr);
  const u = new URL(urlStr)
  const sslmode = u.searchParams.get('sslmode') || u.searchParams.get('ssl')
  const useSsl = sslmode && (sslmode === 'require' || sslmode === 'true' || sslmode === '1')
  
  console.log('URL object properties:');
  console.log('  href:', u.href);
  console.log('  hostname:', u.hostname);
  console.log('  port:', u.port);
  console.log('  pathname:', u.pathname);
  console.log('  search:', u.search);
  console.log('  username:', u.username);
  
  // Pathname '/new-backend' -> 'new-backend' olarak temizle
  let database = u.pathname;
  console.log('Original pathname:', database);
  if (database.startsWith('/')) {
    database = database.substring(1);
  }
  console.log('Database after cleaning:', database);
  
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: database,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  }
}

// Monolitik yapı için sadece DATABASE_URL kullan
const databaseUrl = env.DATABASE_URL;
console.log('Database URL being used:', databaseUrl);
const poolConfig = parsePoolConfig(databaseUrl);
console.log('Pool configuration:', {
  host: poolConfig.host,
  port: poolConfig.port,
  database: poolConfig.database,
  user: poolConfig.user,
  ssl: poolConfig.ssl ? 'enabled' : 'disabled'
});
export const pool = new Pool(poolConfig)
export const db = drizzle(pool, { schema })