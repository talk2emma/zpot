import type { AppNotification, NotificationPrefs, Paginated } from '../../types/contracts';
import { api } from './client';

export const notificationsApi = {
  list: () => api.get<Paginated<AppNotification> & { unread_count: number }>('/notifications/').then(r => r.data),
  get: (id: string) => api.get<AppNotification>(`/notifications/${id}/`).then(r => r.data),
  read: (id: string) => api.post<AppNotification>(`/notifications/${id}/read/`).then(r => r.data),
  readAll: () => api.post<{ updated: number }>('/notifications/read-all/').then(r => r.data),
  prefs: () => api.get<NotificationPrefs>('/notifications/preferences/').then(r => r.data),
  updatePrefs: (p: Partial<NotificationPrefs>) => api.patch<NotificationPrefs>('/notifications/preferences/', p).then(r => r.data),
  registerDevice: (platform: 'ios' | 'android', push_token: string, app_version: string) =>
    api.post('/devices/', { platform, push_token, app_version }).then(r => r.data),
};
