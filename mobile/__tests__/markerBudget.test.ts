import { pickMarkers } from '../src/components/maps/markerBudget';
import type { ParkingFeature } from '../src/components/maps/types';

const f = (id: number, longitude: number, latitude: number) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties: { id, name: `A${id}`, category: 'free', layer: 'free', kind: 'street', rate_per_hour: null, leave_by: null,
    longitude, latitude, availability_status: 'unknown' },
}) as unknown as ParkingFeature;

const center = { longitude: 0, latitude: 0 };
const grid = Array.from({ length: 500 }, (_, i) => f(i + 1, (i % 25) * 0.001 - 0.012, Math.floor(i / 25) * 0.001 - 0.01));

describe('pickMarkers (native marker budget)', () => {
  it('never mounts more than the cap, even when the API returns 500 areas', () => {
    expect(pickMarkers(grid, null, center, null, 60)).toHaveLength(60);
  });
  it('keeps the markers nearest the map centre', () => {
    const near = f(9001, 0, 0);
    const out = pickMarkers([...grid, near], null, center, null, 5);
    expect(out.map(x => x.properties.id)).toContain(9001);
  });
  it('drops markers outside the visible bounds', () => {
    const out = pickMarkers([f(1, 0, 0), f(2, 5, 5)], [-0.01, -0.01, 0.01, 0.01], center, null);
    expect(out.map(x => x.properties.id)).toEqual([1]);
  });
  it('always keeps the selected area, even off-screen', () => {
    const out = pickMarkers([f(1, 0, 0), f(2, 5, 5)], [-0.01, -0.01, 0.01, 0.01], center, 2);
    expect(out.map(x => x.properties.id).sort()).toEqual([1, 2]);
  });
});

describe('sameBounds', () => {
  const { sameBounds } = require('../src/components/maps/markerBudget');
  it('treats sub-metre jitter as the same viewport, real moves as different', () => {
    expect(sameBounds([0, 0, 1, 1], [0.000001, 0, 1, 1])).toBe(true);
    expect(sameBounds([0, 0, 1, 1], [0.001, 0, 1, 1])).toBe(false);
  });
});
