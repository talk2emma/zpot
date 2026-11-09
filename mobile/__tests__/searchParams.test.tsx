import { act, renderHook } from '@testing-library/react-native';
import { useSearchParams } from '../src/hooks/useParking';
import { usePrefsStore } from '../src/store/prefsStore';
import { arrivalParam, DEFAULT_FILTERS, useSearchStore } from '../src/store/searchStore';

const DEST = { id: 'saldanha', name: 'Saldanha', subtitle: '', latitude: 38.7347, longitude: -9.145 };

beforeEach(() => {
  useSearchStore.setState({ destination: null, origin: null, filters: DEFAULT_FILTERS,
    plan: { useNow: true, day: 'today', hour: 10, durationHours: 2 } });
  usePrefsStore.setState(s => ({ parking: { ...s.parking, permitType: null, hasDisabledBadge: false } }));
});

describe('filter changes alter real query parameters', () => {
  it('no destination and no location → no query', async () => {
    expect((await renderHook(() => useSearchParams())).result.current.params).toBeNull();
  });
  it('destination + defaults', async () => {
    await act(() => useSearchStore.getState().setDestination(DEST));
    const p = (await renderHook(() => useSearchParams())).result.current.params!;
    expect(p).toMatchObject({ destination_latitude: 38.7347, destination_longitude: -9.145, duration_minutes: 120, max_walk_minutes: 10 });
    expect(p.include_paid).toBeUndefined();
    expect(p.arrival_at).toBeUndefined(); // now
  });
  it('filters, plan and permit preferences map onto parameters', async () => {
    await act(() => {
      useSearchStore.getState().setDestination(DEST);
      useSearchStore.getState().setFilters({ includePaid: true, maxCost: 5, verifiedOnly: true, maxWalk: 15 });
      useSearchStore.getState().setPlan({ useNow: false, day: 'tomorrow', hour: 7, durationHours: 3 });
      usePrefsStore.getState().setParking({ permitType: 'lisbon-resident-saldanha', hasDisabledBadge: true });
    });
    const p = (await renderHook(() => useSearchParams())).result.current.params!;
    expect(p).toMatchObject({ include_paid: true, max_price: '5', verified_only: true, max_walk_minutes: 15,
      duration_minutes: 180, permit_type: 'lisbon-resident-saldanha', has_disabled_badge: true });
    expect(p.arrival_at).toMatch(/^\d{4}-\d{2}-\d{2}T07:00:00$/);
  });
  it('free-only wins over paid alternatives', async () => {
    await act(() => {
      useSearchStore.getState().setDestination(DEST);
      useSearchStore.getState().setFilters({ includePaid: true, freeOnly: true, maxCost: 5 });
    });
    const p = (await renderHook(() => useSearchParams())).result.current.params!;
    expect(p.free_only).toBe(true);
    expect(p.include_paid).toBeUndefined();
    expect(p.max_price).toBeUndefined();
  });
  it('arrival param is naive Lisbon-local time', async () => {
    expect(arrivalParam({ useNow: false, day: 'today', hour: 9, durationHours: 1 }, new Date('2026-07-06T07:30:00Z')))
      .toBe('2026-07-06T09:00:00');
  });
});
