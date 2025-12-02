import "dotenv/config";
import { z } from "zod";
import { readFileSync } from "fs";

// Fix: Manually read DATABASE_URL and REDIS_URL from .env file to avoid dotenv truncation
let databaseUrlFromFile = "";
let redisUrlFromFile = "";
try {
  const envFileContent = readFileSync('.env', 'utf-8');
  const databaseUrlLine = envFileContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
  const redisUrlLine = envFileContent.split('\n').find(line => line.startsWith('REDIS_URL='));
  
  if (databaseUrlLine) {
    databaseUrlFromFile = databaseUrlLine.substring('DATABASE_URL='.length).trim();
  }
  if (redisUrlLine) {
    redisUrlFromFile = redisUrlLine.substring('REDIS_URL='.length).trim();
  }
  
  console.log('=== MANUAL .env READ ===');
  console.log('Extracted DATABASE_URL from file:', databaseUrlFromFile);
  console.log('Length:', databaseUrlFromFile.length);
  console.log('Extracted REDIS_URL from file:', redisUrlFromFile);
  console.log('Length:', redisUrlFromFile.length);
} catch (error) {
  console.log('Could not read .env file:', error);
}

// Robust port resolution: prefer KUAFORUN_PORT, then generic PORT if valid; fallback to 4000
const resolvePort = (): number => {
  const candidates = [process.env.KUAFORUN_PORT, process.env.PORT];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      const p = Number.parseInt(c, 10);
      if (Number.isFinite(p) && p >= 0 && p < 65536) return p;
    }
  }
  return 4000;
};

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"]) 
    .default("development"),
  // Use preprocessed safe port resolution to avoid NaN
  PORT: z.preprocess(() => resolvePort(), z.number()),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://postgres:postgres@localhost:5432/hono_auth")
    .transform(() => databaseUrlFromFile || process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/hono_auth"),

  // Auth ile ilgili environment variable'lar kaldırıldı - services/auth mikroservisi kullanılıyor
  // JWT_SECRET, BCRYPT_SALT_ROUNDS, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN
  // REFRESH_COOKIE_NAME, REFRESH_COOKIE_SECURE, REFRESH_COOKIE_PATH

  // Gateway ve Tenant bilgileri
  GATEWAY_URL: z.string().default("http://localhost:3000"),
  TENANT_ID: z.string().default("kuaforun"),

  // SerpAPI ve Google Maps API için environment variable'lar
  SERPAPI_KEY: z.string().optional(),
  SERPAPI_DEFAULT_LANG: z.string().optional(),
  SERPAPI_DEFAULT_ZOOM: z.coerce.number().optional(),
  SERPAPI_DEFAULT_RADIUS: z.coerce.number().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.string().optional(),
  LOG_PRETTY: z.string().optional(),

  // Redis Configuration
  REDIS_URL: z
    .string()
    .optional()
    .transform(() => redisUrlFromFile || process.env.REDIS_URL),

  // JWT Secrets
  JWT_SECRET: z.string().default("your-super-secret-jwt-key-change-this-in-production"),
  JWT_REFRESH_SECRET: z.string().default("your-super-secret-refresh-key-change-this-in-production"),

  

  // S3 Configuration (optional)
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  // Booking otomasyon ayarları
  AUTO_BOOKING_NO_SHOW: z.coerce.boolean().default(true),
  AUTO_BOOKING_COMPLETE: z.coerce.boolean().default(false),
  BOOKING_STATUS_GRACE_MINUTES: z.coerce.number().default(15),
});

export const env = envSchema.parse(process.env);

console.log('=== ENV DEBUG ===');
console.log('process.env.DATABASE_URL length:', process.env.DATABASE_URL?.length);
console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL);
console.log('parsed env.DATABASE_URL length:', env.DATABASE_URL.length);
console.log('parsed env.DATABASE_URL:', env.DATABASE_URL);
console.log('=== SERPAPI DEBUG ===');
console.log('process.env.SERPAPI_KEY exists:', !!process.env.SERPAPI_KEY);
console.log('process.env.SERPAPI_KEY length:', process.env.SERPAPI_KEY?.length);
console.log('parsed env.SERPAPI_KEY exists:', !!env.SERPAPI_KEY);
console.log('parsed env.SERPAPI_KEY length:', env.SERPAPI_KEY?.length);
console.log('parsed env.REDIS_URL:', env.REDIS_URL);
