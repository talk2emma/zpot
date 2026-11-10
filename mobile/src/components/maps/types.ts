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

export interface ExtraMarker {
  id: string; coordinate: LatLng; kind: 'vacancy' | 'conflict' | 'pin'; label: string; onPress?: () => void;
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
  /** Non-parking pins: short-lived community vacancy reports and the report-location pin. */
  extraMarkers?: ExtraMarker[];
  showUserLocation?: boolean;
  markerLabel: (f: MapFeatureProps) => string;
  onSelect: (id: number | null) => void;
  onRegionChange?: (r: RegionChange) => void;
  onMapError?: () => void;
  bottomInset?: number;
  /** Extra lift for the logo/attribution above bottomInset, so floating buttons never cover them (Mapbox ToS). */
  ornamentOffset?: number;
  testID?: string;
}
