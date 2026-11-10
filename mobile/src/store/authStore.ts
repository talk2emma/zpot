import { create } from 'zustand';
import { queryClient } from '../services/queryClient';
import { usePrefsStore } from './prefsStore';
import { authApi, authSession, savedApi } from '../services/api';
import { tokenStorage } from '../services/auth/tokenStorage';
import type { AuthResponse, User } from '../types/api';

export type AuthStatus = 'loading' | 'guest' | 'authenticated';

/** Where to return after sign-in so a guest journey is never lost. */
export interface PendingReturn { route: string; params?: Record<string, unknown>; action?: string }

interface AuthState {
  status: AuthStatus;
  user: User | null;
  sessionExpired: boolean;
  pendingReturn: PendingReturn | null;
  lastImport: number;
  bootstrap(): Promise<void>;
  completeAuth(res: AuthResponse): Promise<void>;
  setUser(u: User): void;
  signOut(): Promise<void>;
  clearLocalSession(expired?: boolean): Promise<void>;
  setPendingReturn(p: PendingReturn | null): void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  sessionExpired: false,
  pendingReturn: null,
  lastImport: 0,
  async bootstrap() {
    const tokens = await tokenStorage.load();
    if (!tokens) { set({ status: 'guest' }); return; }
    authSession.set(tokens);
    try {
      const user = await authApi.me();
      set({ status: 'authenticated', user });
    } catch (e: unknown) {
      const err = e as { isAuth?: boolean; isOffline?: boolean };
      if (err?.isOffline) {
        // keep the session; the user can keep browsing as before and we retry later
        set({ status: 'authenticated', user: get().user });
      } else {
        await get().clearLocalSession(Boolean(err?.isAuth));
      }
    }
  },
  async completeAuth(res) {
    queryClient.clear(); // never show the previous identity's cached data
    authSession.set(res.tokens);
    await tokenStorage.save(res.tokens);
    set({ status: 'authenticated', user: res.user, sessionExpired: false });
    await transferGuestSaved();
  },
  setUser: user => set({ user }),
  async signOut() {
    const t = authSession.get();
    try { if (t?.refresh) await authApi.logout(t.refresh); } catch { /* local sign-out still proceeds */ }
    await get().clearLocalSession(false);
  },
  async clearLocalSession(expired = false) {
    queryClient.clear(); // sign-out, expiry and deletion: drop every cached server response of this user
    authSession.set(null);
    await tokenStorage.clear();
    set({ status: 'guest', user: null, sessionExpired: expired });
  },
  setPendingReturn: pendingReturn => set({ pendingReturn }),
}));

/** Moves places saved on this device as a guest into the account (idempotent server-side). */
export async function transferGuestSaved(): Promise<number> {
  const items = usePrefsStore.getState().guestSaved;
  if (!items.length) return 0;
  try {
    const r = await savedApi.importGuest(items.map(i => ({ area_id: i.areaId, label: i.label })));
    usePrefsStore.getState().clearGuestSaved();
    useAuthStore.setState({ lastImport: r.imported + r.already_saved });
    return r.imported;
  } catch {
    return 0; // kept on device; retried at next sign-in — never silently dropped
  }
}

authSession.onExpired(() => { void useAuthStore.getState().clearLocalSession(true); });
