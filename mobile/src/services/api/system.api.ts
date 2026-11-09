import type { PublicConfig } from '../../types/api';
import { api } from './client';

export const systemApi = {
  health: () => api.get<{ status: string; version: string }>('/health/', { timeout: 5000 }).then(r => r.data),
  config: () => api.get<PublicConfig>('/config/').then(r => r.data),
};
