import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  LocationPuck,
  MapView,
  type MapState,
  MarkerView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ENV } from '../../../constants/env';
import { palette, parkingColors } from '../../../theme';
import { ParkingMapMarker } from '../../parking/ParkingMapMarker';
import { type Bounds, pickMarkers, sameBounds } from '../markerBudget';
import type { ZpotMapHandle, ZpotMapProps } from '../types';

// Public (pk.*) token only — gen-env.js refuses sk.* values. Telemetry is off: Zpot is GDPR-consent driven
// and has no consent basis for third-party usage telemetry.
if (ENV.mapboxPublicToken) {
  void Mapbox.setAccessToken(ENV.mapboxPublicToken);
  Mapbox.setTelemetryEnabled(false);
}

const MARKER_MIN_ZOOM = 14;

// Style objects are module constants so React never sends "changed" props to native layers on re-render (M-11).
const COLOR = ['match', ['get', 'category'],
  'free', parkingColors.free.line, 'free_time_limited', parkingColors.free_time_limited.line,
  'paid', parkingColors.paid.line, 'restricted', parkingColors.restricted.line, parkingColors.unknown.line];
const WIDTH = ['case', ['==', ['get', 'selected'], 1], 11, 8];
const FILL_FILTER = ['==', ['geometry-type'], 'Polygon'];
const FILL_STYLE = { fillColor: COLOR, fillOpacity: 0.35 };
const LINE_FILTER = ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['in', ['get', 'category'], ['literal', ['restricted', 'unknown']]]]];
const LINE_STYLE = { lineCap: 'round', lineJoin: 'round', lineColor: COLOR, lineWidth: WIDTH };
const DASH_FILTER = ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'category'], ['literal', ['restricted', 'unknown']]]];
const DASH_STYLE = { lineCap: 'butt', lineColor: COLOR, lineWidth: WIDTH, lineDasharray: [1.2, 0.8] };
const CLUSTER_FILTER = ['has', 'point_count'];
const CLUSTER_STYLE = { circleColor: palette.navy900, circleRadius: ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
  circleStrokeColor: palette.white, circleStrokeWidth: 2 };
// Fonts hosted by the Mapbox glyph API for the default Mapbox styles.
const COUNT_STYLE = { textField: ['get', 'point_count_abbreviated'], textSize: 13, textAllowOverlap: true,
  textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'], textColor: palette.white };
const ANCHOR_BOTTOM = { x: 0.5, y: 1 };
const ANCHOR_CENTER = { x: 0.5, y: 0.5 };

/** Mapbox Maps SDK v11 implementation (@rnmapbox/maps). Implements the provider-agnostic ZpotMap contract. */
export const MapboxMapView = forwardRef<ZpotMapHandle, ZpotMapProps>(function MapboxMapView(props, ref) {
  const { styleUrl, center, initialZoom = 15, features, layers, selectedId, destination, showUserLocation,
    markerLabel, onSelect, onRegionChange, onMapError, bottomInset = 0, ornamentOffset = 8, testID, extraMarkers } = props;
  const camera = useRef<Camera>(null);
  const zoomRef = useRef(initialZoom);
  const gestureRef = useRef(false);
  const lastRegion = useRef<Bounds | null>(null);
  // Only the marker threshold matters to React: re-render on crossing it, not on every pan/zoom (M-10).
  const [showMarkers, setShowMarkers] = useState(initialZoom >= MARKER_MIN_ZOOM);
  const [defaultSettings] = useState(() => ({ centerCoordinate: [center.longitude, center.latitude], zoomLevel: initialZoom }));
  // Viewport as of the last idle camera: limits mounted marker views (see markerBudget.ts). Updated on idle only.
  const [view, setView] = useState<{ bounds: Bounds | null; center: { latitude: number; longitude: number } }>(
    () => ({ bounds: null, center }));

  useImperativeHandle(ref, () => ({
    flyTo: (c, z) => camera.current?.setCamera({ centerCoordinate: [c.longitude, c.latitude],
      zoomLevel: z ?? Math.max(zoomRef.current, 15), animationMode: 'flyTo', animationDuration: 600,
      padding: { paddingTop: 0, paddingLeft: 0, paddingRight: 0, paddingBottom: bottomInset } }),
    zoomBy: d => camera.current?.zoomTo(Math.min(19, Math.max(10, zoomRef.current + d)), 250),
    fitTo: pts => {
      if (!pts.length) return;
      const lngs = pts.map(p => p.longitude);
      const lats = pts.map(p => p.latitude);
      // padding order: [top, right, bottom, left]
      camera.current?.fitBounds([Math.max(...lngs), Math.max(...lats)], [Math.min(...lngs), Math.min(...lats)],
        [140, 40, bottomInset + 40, 40], 500);
    },
  }), [bottomInset]);

  const visible = useMemo(() => features.filter(f => layers[f.properties.layer]), [features, layers]);
  const shapes = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: visible.filter(f => f.geometry.type !== 'Point').map(f => ({ ...f,
      properties: { ...f.properties, selected: f.properties.id === selectedId ? 1 : 0 } })),
  }), [visible, selectedId]);
  const points = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: visible.map(f => ({ type: 'Feature', id: f.properties.id, properties: { id: f.properties.id },
      geometry: { type: 'Point', coordinates: [f.properties.longitude, f.properties.latitude] } })),
  }), [visible]);

  const markers = useMemo(() => (showMarkers ? pickMarkers(visible, view.bounds, view.center, selectedId) : []),
    [showMarkers, visible, view, selectedId]);

  const onIdle = (s: MapState) => {
    const { center: c, zoom, bounds } = s.properties;
    zoomRef.current = zoom;
    const markersOn = zoom >= MARKER_MIN_ZOOM;
    setShowMarkers(markersOn);
    // Only track the viewport while markers are shown, and only when it really moved. onMapIdle also fires after
    // every re-render/tile load with an unchanged camera; storing a fresh object each time would re-render the
    // markers, which re-renders the map, which fires onMapIdle again: a render loop that starves the JS thread.
    if (markersOn) {
      const next: Bounds = [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]];
      setView(prev => (prev.bounds && sameBounds(prev.bounds, next) ? prev
        : { bounds: next, center: { longitude: c[0], latitude: c[1] } }));
    }
    const userInteraction = gestureRef.current;
    gestureRef.current = false;
    // Forward real camera changes only (same reason as above): screens never see idle events for a still camera.
    const region: Bounds = [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]];
    if (!userInteraction && lastRegion.current && sameBounds(lastRegion.current, region)) return;
    lastRegion.current = region;
    onRegionChange?.({ center: { longitude: c[0], latitude: c[1] }, zoom, bounds: region, userInteraction });
  };

  return (
    <View style={styles.flex} testID={testID}>
      <MapView
        style={styles.flex}
        styleURL={styleUrl}
        // Mapbox ToS: the wordmark and attribution must stay visible.
        logoEnabled
        logoPosition={{ bottom: bottomInset + ornamentOffset, left: 8 }}
        attributionEnabled
        attributionPosition={{ bottom: bottomInset + ornamentOffset, left: 96 }}
        compassEnabled={false}
        scaleBarEnabled={false}
        onPress={() => onSelect(null)}
        onMapLoadingError={() => onMapError?.()}
        onCameraChanged={s => { if (s.gestures.isGestureActive) gestureRef.current = true; }}
        onMapIdle={onIdle}>
        <Camera ref={camera} defaultSettings={defaultSettings} />

        <ShapeSource id="zpot-shapes" shape={shapes} onPress={e => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === 'number') onSelect(id);
        }}>
          <FillLayer id="zpot-carparks" filter={FILL_FILTER as never} style={FILL_STYLE as never} />
          <LineLayer id="zpot-lines" filter={LINE_FILTER as never} style={LINE_STYLE as never} />
          <LineLayer id="zpot-lines-dashed" filter={DASH_FILTER as never} style={DASH_STYLE as never} />
        </ShapeSource>

        <ShapeSource id="zpot-clusters" shape={points} cluster clusterRadius={44} clusterMaxZoomLevel={MARKER_MIN_ZOOM - 1}>
          <CircleLayer id="zpot-cluster-circles" filter={CLUSTER_FILTER as never} maxZoomLevel={MARKER_MIN_ZOOM}
            style={CLUSTER_STYLE as never} />
          <SymbolLayer id="zpot-cluster-count" filter={CLUSTER_FILTER as never} maxZoomLevel={MARKER_MIN_ZOOM}
            style={COUNT_STYLE as never} />
        </ShapeSource>

        {markers.map(f => (
          <MarkerView key={f.properties.id} coordinate={[f.properties.longitude, f.properties.latitude]}
            anchor={ANCHOR_BOTTOM} allowOverlap>
            <Pressable accessibilityRole="button" testID={`map-marker-${f.properties.id}`}
              accessibilityLabel={`${f.properties.name}, ${markerLabel(f.properties)}`} onPress={() => onSelect(f.properties.id)}>
              <ParkingMapMarker category={f.properties.category} label={markerLabel(f.properties)}
                selected={f.properties.id === selectedId} />
            </Pressable>
          </MarkerView>
        ))}

        {destination ? (
          <MarkerView coordinate={[destination.coordinate.longitude, destination.coordinate.latitude]} anchor={ANCHOR_BOTTOM}
            allowOverlap>
            <View style={styles.dest} accessibilityLabel={destination.label}>
              <View style={styles.destPill}><Text style={styles.destText} numberOfLines={1}>{destination.label}</Text></View>
              <View style={styles.destStem} />
              <View style={styles.destDot} />
            </View>
          </MarkerView>
        ) : null}

        {extraMarkers?.map(m => (
          <MarkerView key={m.id} coordinate={[m.coordinate.longitude, m.coordinate.latitude]}
            anchor={m.kind === 'pin' ? ANCHOR_BOTTOM : ANCHOR_CENTER} allowOverlap>
            <Pressable accessibilityRole={m.onPress ? 'button' : 'image'} accessibilityLabel={m.label} onPress={m.onPress}
              testID={`map-extra-${m.id}`} disabled={!m.onPress}>
              {m.kind === 'pin' ? (
                <View style={styles.dest}><View style={styles.pinHead} /><View style={styles.destStem} /></View>
              ) : (
                <View style={[styles.vac, m.kind === 'conflict' && styles.vacConflict]}><Text style={styles.vacText}>P</Text></View>
              )}
            </Pressable>
          </MarkerView>
        ))}

        {showUserLocation ? <LocationPuck pulsing={{ isEnabled: true }} /> : null}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dest: { alignItems: 'center' },
  destPill: { backgroundColor: palette.navy900, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 },
  destText: { color: palette.white, fontWeight: '800', fontSize: 12 },
  destStem: { width: 2, height: 12, backgroundColor: palette.navy900 },
  pinHead: { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.red600, borderWidth: 3, borderColor: palette.white },
  vac: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.green700, borderWidth: 2, borderColor: palette.white,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  vacConflict: { backgroundColor: palette.amber900 },
  vacText: { color: palette.white, fontWeight: '800', fontSize: 12 },
  destDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.navy900 },
});
