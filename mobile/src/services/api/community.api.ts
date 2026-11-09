import { api } from './client';

export interface Contributions {
  karma: number; reports: number; accepted: number; published: number; verifications: number;
  level: 'new' | 'contributor' | 'trusted'; recent_events: { reason: string; delta: number; created_at: string }[];
}

export const communityApi = {
  me: () => api.get<Contributions>('/community/me/').then(r => r.data),
};
