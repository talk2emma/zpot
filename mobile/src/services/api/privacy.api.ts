import type { PrivacyRequest } from '../../types/contracts';
import { api } from './client';

export type Consents = Record<string, { granted: boolean; recorded_at: string | null; document_version: string | null }>;

export const privacyApi = {
  consents: () => api.get<Consents>('/privacy/consents/').then(r => r.data),
  updateConsents: (c: Record<string, boolean>, source: 'consent_prompt' | 'privacy_settings' = 'privacy_settings') =>
    api.patch<Consents>('/privacy/consents/', { ...c, source }).then(r => r.data),
  requestExport: () => api.post<PrivacyRequest>('/privacy/data-export/').then(r => r.data),
  requestDeletion: (confirm: string) => api.post<PrivacyRequest>('/privacy/deletion-request/', { confirm }).then(r => r.data),
  requests: () => api.get<PrivacyRequest[]>('/privacy/requests/').then(r => r.data),
  download: (id: string) => api.get<string>(`/privacy/requests/${id}/download/`, { responseType: 'text', transformResponse: x => x })
    .then(r => r.data),
};
