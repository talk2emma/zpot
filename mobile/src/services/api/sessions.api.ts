import type { Paginated, Reminder, Session, SessionListItem, SessionSummary, SessionWithWarnings } from '../../types/contracts';
import { api } from './client';

export interface StartSessionBody {
  area_id: number; duration_minutes?: number; planned_end_at?: string; reminder_minutes?: number;
  vehicle_class?: string; permit_type?: string; has_disabled_badge?: boolean;
}

export const sessionsApi = {
  list: (status?: string) => api.get<Paginated<SessionListItem>>('/sessions/', { params: status ? { status } : {} }).then(r => r.data),
  /** null when there is no active session (API returns 204) */
  active: () => api.get<Session | ''>('/sessions/active/').then(r => (r.status === 204 || !r.data ? null : (r.data as Session))),
  get: (id: string) => api.get<Session>(`/sessions/${id}/`).then(r => r.data),
  start: (body: StartSessionBody) => api.post<SessionWithWarnings>('/sessions/', body).then(r => r.data),
  update: (id: string, body: { planned_end_at?: string; reminder_minutes?: number }) =>
    api.patch<SessionWithWarnings>(`/sessions/${id}/`, body).then(r => r.data),
  end: (id: string, body: { cost_paid?: string | null; outcome?: string; share_departure?: boolean }) =>
    api.post<{ session: Session; already_ended: boolean; summary: SessionSummary }>(`/sessions/${id}/end/`, body).then(r => r.data),
  summary: (id: string) => api.get<SessionSummary>(`/sessions/${id}/summary/`).then(r => r.data),
  reminders: (id: string) => api.get<Reminder[]>(`/sessions/${id}/reminders/`).then(r => r.data),
  addReminder: (id: string, minutes_before: number) => api.post<Reminder>(`/sessions/${id}/reminders/`, { minutes_before }).then(r => r.data),
  deleteReminder: (id: string, reminderId: number) => api.delete(`/sessions/${id}/reminders/${reminderId}/`).then(() => undefined),
};
