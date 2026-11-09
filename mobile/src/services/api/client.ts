import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { ENV } from '../../constants/env';
import type { Tokens } from '../../types/api';
import { tokenStorage } from '../auth/tokenStorage';
import { normaliseError } from './errors';
import { installToken } from './installToken';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean; _attempt?: number };

let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshInFlight: Promise<Tokens | null> | null = null;

export const authSession = {
  set(next: Tokens | null) { tokens = next; },
  get() { return tokens; },
  onExpired(cb: () => void) { onSessionExpired = cb; },
};

export const api: AxiosInstance = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: ENV.requestTimeoutMs,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

const AUTH_FREE = ['/auth/login/', '/auth/register/', '/auth/refresh/', '/auth/password-reset/', '/auth/verify-email/'];

api.interceptors.request.use(async cfg => {
  const url = cfg.url ?? '';
  cfg.headers.set('X-Zpot-Client', await installToken());
  if (tokens?.access && !AUTH_FREE.some(p => url.startsWith(p))) {
    cfg.headers.set('Authorization', `Bearer ${tokens.access}`);
  }
  return cfg;
});

async function refreshTokens(): Promise<Tokens | null> {
  if (!tokens?.refresh) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { data } = await axios.post<Tokens>(`${ENV.apiBaseUrl}/auth/refresh/`, { refresh: tokens?.refresh },
          { timeout: ENV.requestTimeoutMs });
        const next = { access: data.access, refresh: data.refresh ?? tokens!.refresh };
        tokens = next;
        await tokenStorage.save(next);
        return next;
      } catch {
        return null;
      } finally {
        setTimeout(() => { refreshInFlight = null; }, 0);
      }
    })();
  }
  return refreshInFlight;
}

const sleep = (ms: number) => new Promise<void>(r => { setTimeout(() => r(), ms); });

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const cfg = error.config as RetriableConfig | undefined;
  const status = error.response?.status;
  // 1) One transparent refresh on 401 for authenticated requests
  if (cfg && status === 401 && tokens?.refresh && !cfg._retried && !AUTH_FREE.some(p => (cfg.url ?? '').startsWith(p))) {
    cfg._retried = true;
    const next = await refreshTokens();
    if (next) {
      cfg.headers.set('Authorization', `Bearer ${next.access}`);
      return api.request(cfg);
    }
    tokens = null;
    await tokenStorage.clear();
    onSessionExpired?.();
  }
  // 2) Controlled retries: idempotent GETs only, on network errors / 502-504, max 2 attempts, backoff
  const retriable = !error.response || (status !== undefined && [502, 503, 504].includes(status));
  if (cfg && (cfg.method ?? 'get').toLowerCase() === 'get' && retriable && !axios.isCancel(error)) {
    const attempt = (cfg._attempt ?? 0) + 1;
    if (attempt <= 2) {
      cfg._attempt = attempt;
      await sleep(400 * attempt);
      return api.request(cfg);
    }
  }
  throw normaliseError(error);
});

/** Strips undefined/empty values so query strings only carry chosen parameters. */
export function cleanParams<T extends object>(p: T): Partial<T> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}
