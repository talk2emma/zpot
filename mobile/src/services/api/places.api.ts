import type { Coverage, PlaceResult } from '../../types/api';
import { api, cleanParams } from './client';

export const placesApi = {
  autocomplete: (q: string, near?: { latitude: number; longitude: number }, signal?: AbortSignal) =>
    api.get<{ results: PlaceResult[] }>('/places/autocomplete/', { params: cleanParams({ q, limit: 8, ...near }), signal })
      .then(r => r.data.results),
  geocode: (q: string, signal?: AbortSignal) =>
    api.get<PlaceResult>('/places/geocode/', { params: { q }, signal }).then(r => r.data),
  reverse: (latitude: number, longitude: number, signal?: AbortSignal) =>
    api.get<{ nearest_place: PlaceResult | null; distance_meters: number | null; coverage: Coverage }>(
      '/places/reverse-geocode/', { params: { latitude, longitude }, signal }).then(r => r.data),
};
