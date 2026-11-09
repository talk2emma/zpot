import i18n from '../src/i18n';
import { describeOption, markerLabel } from '../src/features/parking/presentation';
import type { ParkingOption, ParkingOptionsResponse } from '../src/types/api';
import fixture from './fixtures/options-saldanha.json';

const data = fixture as unknown as ParkingOptionsResponse;
const t = i18n.t.bind(i18n);
const byName = (n: string) => data.results.find(r => r.name === n) as ParkingOption;

describe('describeOption (API enums → copy)', () => {
  it('free options say free for the whole stay and never claim availability', async () => {
    const free = data.results.find(r => r.category === 'free')!;
    const d = describeOption(free, t, 'en');
    expect(d.badge).toBe('Free');
    expect(d.headline).toBe('Free for your whole stay');
    expect(d.freshText).toContain('Availability not confirmed');
  });
  it('paid options show the API-computed total cost', async () => {
    const paid = byName('Av. Duque de Ávila');
    const d = describeOption(paid, t, 'en');
    expect(paid.category).toBe('paid');
    expect(d.headline).toMatch(/Paid · about €\d+\.\d{2} for your stay/);
    expect(d.costText).toMatch(/total$/);
  });
  it('unknown options never show a cost', async () => {
    const unk = data.results.find(r => r.category === 'unknown')!;
    expect(describeOption(unk, t, 'en').costText).toBe('Cost unknown');
  });
  it('restricted permit streets explain eligibility', async () => {
    const o = { ...byName('Av. Duque de Ávila'), category: 'restricted' as const,
      blocking_reason: { code: 'permit_required', label: 'Residents only', at: null } };
    expect(describeOption(o, t, 'en').headline).toBe('Residents’ permit holders only');
  });
  it('localises into Portuguese', async () => {
    await i18n.changeLanguage('pt-PT');
    const free = data.results.find(r => r.category === 'free')!;
    expect(describeOption(free, i18n.t.bind(i18n), 'pt-PT').badge).toBe('Grátis');
    await i18n.changeLanguage('en');
  });
  it('marker labels follow the prototype legend', async () => {
    expect(markerLabel('free', t, { lang: 'en' })).toBe('Free');
    expect(markerLabel('paid', t, { lang: 'en', rate: '1.60' })).toMatch(/1\.60\/h$/);
    expect(markerLabel('restricted', t, { lang: 'en' })).toBe('×');
    expect(markerLabel('unknown', t, { lang: 'en' })).toBe('?');
  });
});
