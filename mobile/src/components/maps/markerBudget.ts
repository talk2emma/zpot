import type { LatLng } from '../../types/api';
import type { ParkingFeature } from './types';

/**
 * Upper bound on simultaneously mounted native marker views. Each MarkerView is a real native view plus a React
 * subtree that the map SDK repositions every frame; hundreds of them (the API returns up to 500 areas) exhaust
 * memory and drop frames on mid/low-end Android. Polygons, lines and clusters are GPU layers and stay unlimited.
 */
export const MAX_MARKERS = 60;

/** [west, south, east, north] */
export type Bounds = [number, number, number, number];

/** True when two viewports differ by less than ~1 m (1e-5°) on every edge — i.e. the camera didn't move. */
export function sameBounds(a: Bounds, b: Bounds, eps = 1e-5): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) < eps);
}

/**
 * Chooses which parking markers to mount: only those inside the visible bounds (with a small margin so panning
 * doesn't pop markers at the edge), nearest to the map centre first, capped at `max`. The selected area is
 * always included so its marker never disappears while its sheet is open.
 */
export function pickMarkers(features: ParkingFeature[], bounds: Bounds | null, center: LatLng, selectedId: number | null,
  max = MAX_MARKERS): ParkingFeature[] {
  let inView = features;
  if (bounds) {
    const [w, s, e, n] = bounds;
    const mx = (e - w) * 0.15;
    const my = (n - s) * 0.15;
    inView = features.filter(f => {
      const { longitude: x, latitude: y } = f.properties;
      return x >= w - mx && x <= e + mx && y >= s - my && y <= n + my;
    });
  }
  if (inView.length > max) {
    const d = (f: ParkingFeature) => (f.properties.longitude - center.longitude) ** 2 + (f.properties.latitude - center.latitude) ** 2;
    inView = [...inView].sort((a, b) => d(a) - d(b)).slice(0, max);
  }
  if (selectedId != null && !inView.some(f => f.properties.id === selectedId)) {
    const sel = features.find(f => f.properties.id === selectedId);
    if (sel) inView = [...inView, sel];
  }
  return inView;
}
