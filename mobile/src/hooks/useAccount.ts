import { useQuery } from '@tanstack/react-query';
import { communityApi, notificationsApi, sessionsApi, systemApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export const qk = {
  activeSession: ['session-active'] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  notifications: ['notifications'] as const,
  myReports: ['reports-mine'] as const,
  saved: ['saved-locations'] as const,
  destinations: ['saved-destinations'] as const,
  recent: ['recent-searches'] as const,
  contributions: ['contributions'] as const,
  config: ['config'] as const,
};

export function useAuthed() {
  return useAuthStore(s => s.status === 'authenticated');
}

export function useActiveSession() {
  const authed = useAuthed();
  return useQuery({ queryKey: qk.activeSession, queryFn: sessionsApi.active, enabled: authed, refetchInterval: 60_000,
    staleTime: 15_000 });
}

/** In-app inbox. Polled while the app is in the foreground (no push provider in this build). */
export function useNotifications() {
  const authed = useAuthed();
  return useQuery({ queryKey: qk.notifications, queryFn: notificationsApi.list, enabled: authed, refetchInterval: 30_000 });
}

export function useContributions() {
  const authed = useAuthed();
  return useQuery({ queryKey: qk.contributions, queryFn: communityApi.me, enabled: authed });
}

/** Server-governed feature flags (/config/). Unknown/unreachable ⇒ treat as off. */
export function useFeatures() {
  const q = useQuery({ queryKey: qk.config, queryFn: systemApi.config, staleTime: 5 * 60_000 });
  const map: Record<string, boolean> = {};
  q.data?.features.forEach(f => { map[f.key] = f.enabled; });
  return { on: (k: string) => !!map[k], loaded: !!q.data };
}

export function useHasRole(role: string) {
  return useAuthStore(s => !!s.user?.roles.includes(role) || !!s.user?.roles.includes('admin'));
}
