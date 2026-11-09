import { create } from 'zustand';
import { authApi, authSession } from '../services/api';
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
    authSession.set(res.tokens);
    await tokenStorage.save(res.tokens);
    set({ status: 'authenticated', user: res.user, sessionExpired: false });
  },
  setUser: user => set({ user }),
  async signOut() {
    const t = authSession.get();
    try { if (t?.refresh) await authApi.logout(t.refresh); } catch { /* local sign-out still proceeds */ }
    await get().clearLocalSession(false);
  },
  async clearLocalSession(expired = false) {
    authSession.set(null);
    await tokenStorage.clear();
    set({ status: 'guest', user: null, sessionExpired: expired });
  },
  setPendingReturn: pendingReturn => set({ pendingReturn }),
}));

authSession.onExpired(() => { void useAuthStore.getState().clearLocalSession(true); });
