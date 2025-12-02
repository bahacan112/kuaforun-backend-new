import { env } from '../../core/env'
import type { IPlacesSearch, PlacesSearchParams, SerpCandidate } from '../../core/contracts/search'
import { AppError } from '../../core/errors'

function buildSerpApiUrl(params: PlacesSearchParams, apiKey: string): string {
  const { lat, lng, query, lang, zoom } = params
  const base = 'https://serpapi.com/search.json'
  const url = new URL(base)
  url.searchParams.set('engine', 'google_maps')
  url.searchParams.set('type', 'search')
  url.searchParams.set('google_domain', 'google.com')
  url.searchParams.set('hl', lang)
  url.searchParams.set('q', query)
  url.searchParams.set('ll', `@${lat},${lng},${zoom}z`)
  url.searchParams.set('api_key', apiKey)
  return url.toString()
}

type SerpLocalResult = {
  title?: string
  name?: string
  address?: string
  phone?: string
  place_id?: string
  photos?: { photo_reference?: string }[]
  gps_coordinates?: { latitude?: number; longitude?: number }
  rating?: number
}

export class SerpApiPlacesSearch implements IPlacesSearch {
  async search(params: PlacesSearchParams): Promise<SerpCandidate[]> {
    if (!env.SERPAPI_KEY) {
      throw new AppError('SERPAPI_KEY is not configured', 500, 'ENV_MISSING')
    }
    const url = buildSerpApiUrl(params, env.SERPAPI_KEY)
    const res = await fetch(url)
    if (!res.ok) {
      throw new AppError('SerpAPI request failed', res.status as 400 | 500, 'SERPAPI_ERROR')
    }
    const json = await res.json() as { local_results?: unknown[] }
    const items = (json.local_results ?? []) as SerpLocalResult[]
    const candidates: SerpCandidate[] = items.map((item) => ({
      name: item.title ?? item.name ?? null,
      address: item.address ?? null,
      phone: item.phone ?? null,
      googlePlaceId: item.place_id ?? null,
      photos: Array.isArray(item.photos)
        ? item.photos
            .map((p) => p.photo_reference)
            .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0)
        : [],
      latitude: typeof item.gps_coordinates?.latitude === 'number' ? item.gps_coordinates.latitude : null,
      longitude: typeof item.gps_coordinates?.longitude === 'number' ? item.gps_coordinates.longitude : null,
      googleRating: typeof item.rating === 'number' ? item.rating : null,
    }))
    return candidates
  }
}