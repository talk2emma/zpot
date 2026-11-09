import type { CreateReport, Paginated, Report, VerificationAnswer } from '../../types/contracts';
import { api } from './client';

export interface PhotoFile { uri: string; type: string; name: string }

export const reportsApi = {
  create: (body: CreateReport) => api.post<Report>('/reports/', body).then(r => r.data),
  mine: () => api.get<Paginated<Report>>('/reports/mine/').then(r => r.data),
  get: (id: string) => api.get<Report>(`/reports/${id}/`).then(r => r.data),
  update: (id: string, description: string) => api.patch<Report>(`/reports/${id}/`, { description }).then(r => r.data),
  uploadPhoto: (id: string, file: PhotoFile, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    return api.post(`/reports/${id}/attachments/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000,
      onUploadProgress: e => onProgress?.(e.total ? e.loaded / e.total : 0),
    }).then(r => r.data);
  },
  verify: (id: string, answer: VerificationAnswer) =>
    api.post<{ observation_id: number; state: string; confirmations: number; contradictions: number; expires_at: string }>(
      `/reports/${id}/verifications/`, { answer }).then(r => r.data),
  appeal: (id: string, message: string) => api.post<Report>(`/reports/${id}/appeals/`, { message }).then(r => r.data),
};
