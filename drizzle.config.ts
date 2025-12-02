import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Monolitik yapı için sadece DATABASE_URL kullan
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
})