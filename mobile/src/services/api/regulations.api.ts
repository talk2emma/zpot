import type { Closure } from '../../types/api';
import { api } from './client';

export interface EvaluateBody {
  area_id: number; arrival_at?: string; duration_minutes: number; vehicle_class?: string; permit_type?: string;
  has_disabled_badge?: boolean;
}

export const regulationsApi = {
  evaluate: (body: EvaluateBody) => api.post('/regulations/evaluate/', body).then(r => r.data),
  closures: (city = 'lisbon', signal?: AbortSignal) =>
    api.get<Closure[]>('/regulations/closures/', { params: { city }, signal }).then(r => r.data),
};
