import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiError } from './api/errors';

/**
 * The app's single server-state cache. Cleared whenever the signed-in identity changes (authStore) so one
 * user's data can never be shown to the next user or to a guest.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // the API client already retries idempotent GETs on network errors; don't multiply retries here
      retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && count < 1,
      // with focusManager wired to AppState (below): stale queries refresh when the app returns to the foreground
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * React Native has no `document.visibilityState`, so TanStack Query would think the app is always focused:
 * every `refetchInterval` poll would keep running in the background. Wire focus to AppState instead.
 */
focusManager.setEventListener(handleFocus => {
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => handleFocus(s === 'active'));
  return () => sub.remove();
});
