import { z } from 'zod'
import { env } from '../../core/env'

export const ImportSerpApiDto = z.object({
  lat: z.number().default(41.0082), // İstanbul koordinatları default
  lng: z.number().default(28.9784), // İstanbul koordinatları default
  query: z.string().default('barber'),
  lang: z.string().default(env.SERPAPI_DEFAULT_LANG ?? 'tr'),
  zoom: z.number().default(env.SERPAPI_DEFAULT_ZOOM ?? 18),
  radius: z.number().default(env.SERPAPI_DEFAULT_RADIUS ?? 300),
  limit: z.number().min(1).max(100).default(20),
  tenantId: z.string().optional(),
})

export type ImportSerpApiInput = z.infer<typeof ImportSerpApiDto>

export const UploadGooglePhotoDto = z.object({
  photoReference: z.string().min(1),
  width: z.number().min(1).max(2048).default(1280),
})

export type UploadGooglePhotoInput = z.infer<typeof UploadGooglePhotoDto>