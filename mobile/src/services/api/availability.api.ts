import type { Observation } from '../../types/contracts';
import { api } from './client';

export const availabilityApi = {
  nearby: (latitude: number, longitude: number, radius_meters = 900, signal?: AbortSignal) =>
    api.get<{ observations: Observation[]; note: string; prediction: string }>('/availability/nearby/',
      { params: { latitude, longitude, radius_meters }, signal }).then(r => r.data),
  forArea: (areaId: number) => api.get<Observation[]>('/availability/observations/', { params: { area: areaId } }).then(r => r.data),
};
