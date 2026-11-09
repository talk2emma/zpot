/**
 * @jest-environment node
 *
 * Live contract tests: run against a real local API (seeded) with `npm run test:contract`.
 * Skipped unless ZPOT_CONTRACT_API is set, so the unit suite never depends on a server.
 */
import {
  areaDetailSchema, authResponseSchema, configSchema, errorSchema, mapLayersSchema, parkingOptionsSchema, placeSchema,
} from '../../src/services/api/schemas';

const BASE = process.env.ZPOT_CONTRACT_API;
const d = BASE ? describe : describe.skip;

function nextMonday10() {
  const d0 = new Date(); d0.setUTCDate(d0.getUTCDate() + 1);
  while (d0.getUTCDay() !== 1) d0.setUTCDate(d0.getUTCDate() + 1);
  return `${d0.toISOString().slice(0, 10)}T10:00:00`;
}
const get = async (path: string) => { const r = await fetch(`${BASE}${path}`); return { status: r.status, body: await r.json() }; };
const post = async (path: string, body: unknown, token?: string) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
};

d('API contract (live)', () => {
  const stay = `arrival_at=${encodeURIComponent(nextMonday10())}&duration_minutes=120`;

  it('config', async () => { const r = await get('/config/'); expect(r.status).toBe(200); configSchema.parse(r.body); });

  it('parking options (guest, free-first)', async () => {
    const r = await get(`/parking/options/?destination_latitude=38.7347&destination_longitude=-9.145&include_paid=true&${stay}`);
    expect(r.status).toBe(200);
    const body = parkingOptionsSchema.parse(r.body);
    expect(body.results.length).toBeGreaterThan(0);
    const ranks = body.results.map(x => x.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('area detail, map layers and places', async () => {
    const opts = parkingOptionsSchema.parse((await get(`/parking/options/?destination_latitude=38.7347&destination_longitude=-9.145&${stay}`)).body);
    const detail = await get(`/parking/areas/${opts.results[0].id}/?${stay}`);
    areaDetailSchema.parse(detail.body);
    mapLayersSchema.parse((await get(`/parking/map-layers/?bbox=-9.16,38.725,-9.13,38.745&${stay}`)).body);
    const ac = await get('/places/autocomplete/?q=campo');
    ac.body.results.forEach((p: unknown) => placeSchema.parse(p));
  });

  it('validation errors use the error envelope', async () => {
    const r = await get('/parking/options/');
    expect(r.status).toBe(400);
    errorSchema.parse(r.body);
  });

  it('register → me → logout round trip', async () => {
    const email = `contract-${Date.now()}@zpot.dev`;
    const reg = await post('/auth/register/', { email, password: 'Contract-pass-123', accept_terms: true });
    expect(reg.status).toBe(201);
    const auth = authResponseSchema.parse(reg.body);
    const me = await fetch(`${BASE}/users/me/`, { headers: { Authorization: `Bearer ${auth.tokens.access}` } });
    expect(me.status).toBe(200);
    const out = await post('/auth/logout/', { refresh: auth.tokens.refresh }, auth.tokens.access);
    expect(out.status).toBe(204);
    const del = await fetch(`${BASE}/users/me/`, { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.tokens.access}` } });
    expect(del.status).toBe(204);
  });
});
