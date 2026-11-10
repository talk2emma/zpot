/**
 * @jest-environment node
 *
 * Live Part 2 contract tests (real seeded API): a fresh account walks the session, report, saved, notification,
 * support, privacy and contribution endpoints, and every response is parsed with the app's runtime schemas.
 */
import {
  commuteCheckSchema, commutePlanSchema, contributionsSchema, entitlementSchema, helpArticleSchema, insightsSchema, vehicleSchema, notificationListSchema, observationSchema, privacyRequestSchema, reportSchema,
  savedLocationSchema, sessionSchema, sessionSummarySchema, sessionWithWarningsSchema, ticketSchema,
} from '../../src/services/api/schemas.part2';

const BASE = process.env.ZPOT_CONTRACT_API;
const d = BASE ? describe : describe.skip;
let token = '';
const guest = `contract-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const r = await fetch(`${BASE}${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra } });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

d('Part 2 API contract (live)', () => {
  beforeAll(async () => {
    const email = `contract-p2-${Date.now()}@example.com`;
    const reg = await call('POST', '/auth/register/', { email, password: 'Contract-pass-123', accept_terms: true });
    expect(reg.status).toBe(201);
    token = reg.body.tokens.access;
  });

  // Area 18 (Rua do Açúcar) has no time-window bans, so this never depends on the wall clock.
  it('session lifecycle', async () => {
    const start = await call('POST', '/sessions/', { area_id: 18, duration_minutes: 60, reminder_minutes: 15 });
    expect(start.status).toBe(201);
    const s = sessionWithWarningsSchema.parse(start.body).session;
    sessionSchema.parse((await call('GET', '/sessions/active/')).body);
    sessionWithWarningsSchema.parse((await call('PATCH', `/sessions/${s.id}/`, { reminder_minutes: 10 })).body);
    const end = await call('POST', `/sessions/${s.id}/end/`, { cost_paid: '1.00', share_departure: false });
    expect(end.status).toBe(200);
    sessionSummarySchema.parse((await call('GET', `/sessions/${s.id}/summary/`)).body);
    expect((await call('GET', '/sessions/active/')).status).toBe(204);
  });

  it('guest availability report and nearby observations', async () => {
    const r = await call('POST', '/reports/', { type: 'found', area_id: 18, latitude: 38.7392, longitude: -9.1012,
      device_latitude: 38.7392, device_longitude: -9.1012 }, { 'X-Zpot-Client': guest, Authorization: '' });
    expect([201, 409]).toContain(r.status); // 409 duplicate if another run reported here in the last 10 min
    if (r.status === 201) reportSchema.parse(r.body);
    const near = await call('GET', '/availability/nearby/?latitude=38.7392&longitude=-9.1012&radius_meters=500');
    near.body.observations.forEach((o: unknown) => observationSchema.parse(o));
  });

  it('rule report is reviewed, never published', async () => {
    const r = await call('POST', '/reports/', { type: 'incorrect_rule', area_id: 2, latitude: 38.7356, longitude: -9.143,
      details: { issue: 'hours' }, description: 'Contract test: sign hours differ' });
    expect(r.status).toBe(201);
    const rep = reportSchema.parse(r.body);
    expect(rep.status).toBe('pending_review');
    expect(rep.observation).toBeNull();
    (await call('GET', '/reports/mine/')).body.results.forEach((x: unknown) => reportSchema.parse(x));
  });

  it('saved places, notifications, contributions', async () => {
    const sv = await call('POST', '/saved/locations/', { area_id: 1, label: 'Contract' });
    savedLocationSchema.parse(sv.body);
    (await call('GET', '/saved/locations/')).body.forEach((x: unknown) => savedLocationSchema.parse(x));
    notificationListSchema.parse((await call('GET', '/notifications/')).body);
    contributionsSchema.parse((await call('GET', '/community/me/')).body);
  });

  it('help, support and privacy', async () => {
    (await call('GET', '/help/articles/?lang=en')).body.forEach((x: unknown) => helpArticleSchema.parse(x));
    const t = await call('POST', '/support/tickets/', { category: 'map_search', description: 'Contract test ticket body' });
    expect(t.status).toBe(201);
    ticketSchema.parse(t.body);
    const ex = await call('POST', '/privacy/data-export/');
    expect(ex.status).toBe(202);
    privacyRequestSchema.parse(ex.body);
  });

  it('planning: vehicles, commute, insights and an honest Free entitlement', async () => {
    entitlementSchema.parse((await call('GET', '/billing/entitlement/')).body);
    const vs = (await call('GET', '/vehicles/')).body;
    vs.forEach((v: unknown) => vehicleSchema.parse(v));
    expect((await call('POST', '/vehicles/', { label: 'Van', vehicle_class: 'van' })).status).toBe(403);
    const p = await call('POST', '/commute/plans/', { label: 'Office', name: 'Saldanha', latitude: 38.7347, longitude: -9.145,
      days: [0, 3], arrival_minute: 600, duration_minutes: 120 });
    expect(p.status).toBe(201);
    const plan = commutePlanSchema.parse(p.body);
    const chk = commuteCheckSchema.parse((await call('GET', `/commute/plans/${plan.id}/check/`)).body);
    expect(chk.days.filter(d => !d.locked)).toHaveLength(1);
    insightsSchema.parse((await call('GET', '/sessions/insights/')).body);
  });
});
