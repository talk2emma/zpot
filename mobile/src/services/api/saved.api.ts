import type { RecentSearch, SavedDestination, SavedLocation } from '../../types/contracts';
import { api } from './client';

export const savedApi = {
  locations: () => api.get<SavedLocation[]>('/saved/locations/').then(r => r.data),
  save: (area_id: number, label?: string) => api.post<SavedLocation>('/saved/locations/', { area_id, label }).then(r => r.data),
  rename: (id: number, label: string) => api.patch<SavedLocation>(`/saved/locations/${id}/`, { label }).then(r => r.data),
  remove: (id: number) => api.delete(`/saved/locations/${id}/`).then(() => undefined),
  importGuest: (items: { area_id: number; label?: string }[]) =>
    api.post<{ imported: number; already_saved: number }>('/saved/locations/import/', { items }).then(r => r.data),
  destinations: () => api.get<SavedDestination[]>('/saved/destinations/').then(r => r.data),
  saveDestination: (b: { label: string; name: string; subtitle?: string; place_ref?: string; latitude: number; longitude: number }) =>
    api.post<SavedDestination>('/saved/destinations/', b).then(r => r.data),
  removeDestination: (id: number) => api.delete(`/saved/destinations/${id}/`).then(() => undefined),
  recent: () => api.get<RecentSearch[]>('/searches/recent/').then(r => r.data),
  addRecent: (b: { place_ref?: string; name: string; subtitle?: string; latitude: number; longitude: number }) =>
    api.post<RecentSearch>('/searches/recent/', b).then(r => r.data),
  clearRecent: () => api.delete('/searches/recent/').then(() => undefined),
};
