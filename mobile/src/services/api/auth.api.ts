import type { AuthResponse, Preferences, Tokens, User } from '../../types/api';
import { api } from './client';

export const authApi = {
  register: (body: { email: string; password: string; accept_terms: boolean; display_name?: string; language?: string }) =>
    api.post<AuthResponse>('/auth/register/', body).then(r => r.data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login/', { email, password }).then(r => r.data),
  refresh: (refresh: string) => api.post<Tokens>('/auth/refresh/', { refresh }).then(r => r.data),
  logout: (refresh: string) => api.post('/auth/logout/', { refresh }).then(() => undefined),
  verifyEmail: (token: string) => api.post<User>('/auth/verify-email/', { token }).then(r => r.data),
  resendVerification: () => api.post('/auth/resend-verification/').then(() => undefined),
  requestPasswordReset: (email: string) => api.post('/auth/password-reset/', { email }).then(() => undefined),
  confirmPasswordReset: (token: string, new_password: string) =>
    api.post('/auth/password-reset/confirm/', { token, new_password }).then(() => undefined),
  me: () => api.get<User>('/users/me/').then(r => r.data),
  updateMe: (patch: { display_name?: string }) => api.patch<User>('/users/me/', patch).then(r => r.data),
  deleteMe: (confirm: string) => api.delete('/users/me/', { data: { confirm } }).then(() => undefined),
  preferences: () => api.get<Preferences>('/users/me/preferences/').then(r => r.data),
  updatePreferences: (patch: Partial<Preferences>) =>
    api.patch<Preferences>('/users/me/preferences/', patch).then(r => r.data),
};
