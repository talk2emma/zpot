import type { LatLng, MapFeatureProps } from '../../types/api';

export type LayerKey = 'free' | 'timed' | 'paid' | 'restrict' | 'unknown';
export const ALL_LAYERS: Record<LayerKey, boolean> = { free: true, timed: true, paid: true, restrict: true, unknown: true };

export type ParkingFeature = GeoJSON.Feature<GeoJSON.Geometry, MapFeatureProps>;

export interface RegionChange { center: LatLng; zoom: number; bounds?: [number, number, number, number]; userInteraction: boolean }

/** Imperative camera API every provider implements. */
export interface ZpotMapHandle {
  flyTo(center: LatLng, zoom?: number): void;
  zoomBy(delta: number): void;
  fitTo(points: LatLng[]): void;
}

/** Provider-agnostic map contract. Swap providers without touching screens. */
export interface ZpotMapProps {
  styleUrl: string;
  center: LatLng;
  initialZoom?: number;
  features: ParkingFeature[];
  layers: Record<LayerKey, boolean>;
  selectedId: number | null;
  destination?: { label: string; coordinate: LatLng } | null;
  showUserLocation?: boolean;
  markerLabel: (f: MapFeatureProps) => string;
  onSelect: (id: number | null) => void;
  onRegionChange?: (r: RegionChange) => void;
  onMapError?: () => void;
  bottomInset?: number;
  testID?: string;
}
