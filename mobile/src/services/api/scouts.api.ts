import type { ScoutAssignment } from '../../types/contracts';
import { api } from './client';
import type { PhotoFile } from './reports.api';

export const scoutsApi = {
  list: () => api.get<ScoutAssignment[]>('/scouts/assignments/').then(r => r.data),
  get: (id: number) => api.get<ScoutAssignment>(`/scouts/assignments/${id}/`).then(r => r.data),
  submit: (id: number, b: { outcome: string; observed_rules?: string; notes?: string; photos: PhotoFile[] }) => {
    const form = new FormData();
    form.append('outcome', b.outcome);
    if (b.observed_rules) form.append('observed_rules', b.observed_rules);
    if (b.notes) form.append('notes', b.notes);
    b.photos.forEach(p => form.append('photos', p as unknown as Blob));
    return api.post<ScoutAssignment>(`/scouts/assignments/${id}/submit/`, form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }).then(r => r.data);
  },
};
