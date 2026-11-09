import type { InternalAxiosRequestConfig } from 'axios';
import { api, authSession } from '../src/services/api/client';
import { ApiError, normaliseError } from '../src/services/api/errors';

type Handler = (cfg: InternalAxiosRequestConfig) => { status: number; data: unknown } | 'network';

function mockAdapter(handler: Handler) {
  api.defaults.adapter = async (cfg: InternalAxiosRequestConfig) => {
    const r = handler(cfg);
    if (r === 'network') { const e: any = new Error('Network Error'); e.isAxiosError = true; e.config = cfg; e.code = 'ERR_NETWORK'; throw e; }
    const response = { data: r.data, status: r.status, statusText: '', headers: {}, config: cfg };
    if (r.status >= 400) { const e: any = new Error(`HTTP ${r.status}`); e.isAxiosError = true; e.config = cfg; e.response = response; throw e; }
    return response;
  };
}

afterEach(() => authSession.set(null));

describe('API client', () => {
  it('normalises the Zpot error envelope with field errors', async () => {
    mockAdapter(() => ({ status: 400, data: { error: { code: 'validation_error', message: 'Some fields are invalid.',
      details: { email: ['An account with this email already exists.'] }, request_id: 'abc' } } }));
    const err = await api.post('/auth/register/', {}).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('validation_error');
    expect(err.fieldError('email')).toMatch(/already exists/);
    expect(err.requestId).toBe('abc');
  });

  it('injects the bearer token', async () => {
    authSession.set({ access: 'AAA', refresh: 'RRR' });
    let seen: string | undefined;
    mockAdapter(cfg => { seen = String(cfg.headers.Authorization); return { status: 200, data: {} }; });
    await api.get('/users/me/');
    expect(seen).toBe('Bearer AAA');
  });

  it('retries idempotent GETs on network failure, then reports offline', async () => {
    let calls = 0;
    mockAdapter(() => { calls += 1; return 'network'; });
    const err = await api.get('/parking/options/').catch(e => e);
    expect(calls).toBe(3); // 1 + 2 controlled retries
    expect(err.isOffline).toBe(true);
  });

  it('does not retry POSTs', async () => {
    let calls = 0;
    mockAdapter(() => { calls += 1; return 'network'; });
    await api.post('/auth/login/', {}).catch(() => undefined);
    expect(calls).toBe(1);
  });

  it('maps unknown errors safely', async () => {
    expect(normaliseError(new Error('boom')).kind).toBe('unknown');
  });
});
