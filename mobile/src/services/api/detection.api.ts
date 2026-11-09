import type { ParkEvent } from '../../types/contracts';
import { api } from './client';

export const detectionApi = {
  config: () => api.get<{ enabled: boolean; phase: string; requirements: string[]; limitations: string[] }>('/detection/config/')
    .then(r => r.data),
  report: (b: { latitude: number; longitude: number; detected_at: string; source?: string; accuracy_m?: number }) =>
    api.post<ParkEvent>('/events/park/', b).then(r => r.data),
  confirm: (id: string) => api.post<ParkEvent>(`/events/park/${id}/confirm/`).then(r => r.data),
  history: () => api.get<ParkEvent[]>('/events/park/').then(r => r.data),
  deleteAll: () => api.delete<{ deleted: number }>('/events/park/').then(r => r.data),
  correct: (id: string, latitude: number, longitude: number) =>
    api.post<ParkEvent>(`/events/park/${id}/correct/`, { latitude, longitude }).then(r => r.data),
  dismiss: (id: string) => api.post<ParkEvent>(`/events/park/${id}/dismiss/`).then(r => r.data),
};
