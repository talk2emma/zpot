import type {
  AreaEvidenceResponse,
  AreaRulesResponse,
  MapLayersResponse,
  ParkingAreaDetail,
  ParkingOptionsResponse,
  ParkingSearchParams,
} from '../../types/api';
import { api, cleanParams } from './client';

type Stay = Pick<ParkingSearchParams, 'arrival_at' | 'duration_minutes' | 'vehicle_class' | 'permit_type' | 'has_disabled_badge'>;

export const parkingApi = {
  options: (params: ParkingSearchParams, signal?: AbortSignal) =>
    api.get<ParkingOptionsResponse>('/parking/options/', { params: cleanParams(params), signal }).then(r => r.data),
  area: (id: number, stay: Stay & { latitude?: number; longitude?: number }, signal?: AbortSignal) =>
    api.get<ParkingAreaDetail>(`/parking/areas/${id}/`, { params: cleanParams(stay), signal }).then(r => r.data),
  rules: (id: number, signal?: AbortSignal) =>
    api.get<AreaRulesResponse>(`/parking/areas/${id}/rules/`, { signal }).then(r => r.data),
  evidence: (id: number, signal?: AbortSignal) =>
    api.get<AreaEvidenceResponse>(`/parking/areas/${id}/evidence/`, { signal }).then(r => r.data),
  mapLayers: (bbox: [number, number, number, number], stay: Stay, signal?: AbortSignal) =>
    api.get<MapLayersResponse>('/parking/map-layers/', { params: cleanParams({ bbox: bbox.join(','), ...stay }), signal })
      .then(r => r.data),
};
