export type SerpCandidate = {
  name?: string | null
  address?: string | null
  phone?: string | null
  googlePlaceId?: string | null
  photos?: string[]
  latitude?: number | null
  longitude?: number | null
  googleRating?: number | null
}

export type PlacesSearchParams = {
  lat: number
  lng: number
  query: string
  lang: string
  zoom: number
}

export interface IPlacesSearch {
  search(params: PlacesSearchParams): Promise<SerpCandidate[]>
}