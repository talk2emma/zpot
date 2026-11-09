import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, parkingColors } from '../../../theme';
import { ParkingMapMarker } from '../../parking/ParkingMapMarker';
import type { ZpotMapHandle, ZpotMapProps } from '../types';

const MARKER_MIN_ZOOM = 14;

/** MapLibre Native implementation (open-source, no access token required). */
export const MapLibreMapView = forwardRef<ZpotMapHandle, ZpotMapProps>(function MapLibreMapView(props, ref) {
  const { styleUrl, center, initialZoom = 15, features, layers, selectedId, destination, showUserLocation,
    markerLabel, onSelect, onRegionChange, onMapError, bottomInset = 0, testID } = props;
  const camera = useRef<CameraRef>(null);
  const zoomRef = useRef(initialZoom);
  const [zoom, setZoom] = useState(initialZoom);

  useImperativeHandle(ref, () => ({
    flyTo: (c, z) => camera.current?.flyTo({ center: [c.longitude, c.latitude], zoom: z ?? Math.max(zoomRef.current, 15),
      duration: 600, padding: { top: 0, left: 0, right: 0, bottom: bottomInset } }),
    zoomBy: d => camera.current?.zoomTo(Math.min(19, Math.max(10, zoomRef.current + d)), { duration: 250 }),
    fitTo: pts => {
      if (!pts.length) return;
      const lngs = pts.map(p => p.longitude);
      const lats = pts.map(p => p.latitude);
      camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 140, left: 40, right: 40, bottom: bottomInset + 40 }, duration: 500 });
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

  const color: unknown = ['match', ['get', 'category'],
    'free', parkingColors.free.line, 'free_time_limited', parkingColors.free_time_limited.line,
    'paid', parkingColors.paid.line, 'restricted', parkingColors.restricted.line, parkingColors.unknown.line];

  return (
    <View style={styles.flex} testID={testID}>
      <Map
        style={styles.flex}
        mapStyle={styleUrl}
        logo={false}
        attribution
        attributionPosition={{ bottom: bottomInset + 8, left: 8 }}
        compass={false}
        onPress={() => onSelect(null)}
        onDidFailLoadingMap={() => onMapError?.()}
        onRegionDidChange={e => {
          const v = e.nativeEvent;
          zoomRef.current = v.zoom;
          setZoom(v.zoom);
          onRegionChange?.({ center: { longitude: v.center[0], latitude: v.center[1] }, zoom: v.zoom, bounds: v.bounds,
            userInteraction: v.userInteraction });
        }}>
        <Camera ref={camera} initialViewState={{ center: [center.longitude, center.latitude], zoom: initialZoom }} />

        <GeoJSONSource id="zpot-shapes" data={shapes} onPress={e => {
          e.stopPropagation?.();
          const id = e.nativeEvent.features?.[0]?.properties?.id;
          if (typeof id === 'number') onSelect(id);
        }}>
          <Layer type="fill" id="zpot-carparks" filter={['==', ['geometry-type'], 'Polygon']}
            paint={{ 'fill-color': color as never, 'fill-opacity': 0.35 }} />
          <Layer type="line" id="zpot-lines" filter={['all', ['==', ['geometry-type'], 'LineString'],
            ['!', ['in', ['get', 'category'], ['literal', ['restricted', 'unknown']]]]]}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': color as never, 'line-width': ['case', ['==', ['get', 'selected'], 1], 11, 8] }} />
          <Layer type="line" id="zpot-lines-dashed" filter={['all', ['==', ['geometry-type'], 'LineString'],
            ['in', ['get', 'category'], ['literal', ['restricted', 'unknown']]]]}
            layout={{ 'line-cap': 'butt' }}
            paint={{ 'line-color': color as never, 'line-width': ['case', ['==', ['get', 'selected'], 1], 11, 8],
              'line-dasharray': [1.2, 0.8] }} />
        </GeoJSONSource>

        <GeoJSONSource id="zpot-clusters" data={points} cluster clusterRadius={44} clusterMaxZoom={MARKER_MIN_ZOOM - 1}>
          <Layer type="circle" id="zpot-cluster-circles" filter={['has', 'point_count']} maxzoom={MARKER_MIN_ZOOM}
            paint={{ 'circle-color': palette.navy900, 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
              'circle-stroke-color': palette.white, 'circle-stroke-width': 2 }} />
          <Layer type="symbol" id="zpot-cluster-count" filter={['has', 'point_count']} maxzoom={MARKER_MIN_ZOOM}
            layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-allow-overlap': true }}
            paint={{ 'text-color': palette.white }} />
        </GeoJSONSource>

        {zoom >= MARKER_MIN_ZOOM && visible.map(f => (
          <Marker key={f.properties.id} id={`mk-${f.properties.id}`} lngLat={[f.properties.longitude, f.properties.latitude]}
            anchor="bottom" onPress={() => onSelect(f.properties.id)}>
            <Pressable accessibilityRole="button" testID={`map-marker-${f.properties.id}`}
              accessibilityLabel={`${f.properties.name}, ${markerLabel(f.properties)}`} onPress={() => onSelect(f.properties.id)}>
              <ParkingMapMarker category={f.properties.category} label={markerLabel(f.properties)}
                selected={f.properties.id === selectedId} />
            </Pressable>
          </Marker>
        ))}

        {destination ? (
          <Marker id="destination" lngLat={[destination.coordinate.longitude, destination.coordinate.latitude]} anchor="bottom">
            <View style={styles.dest} accessibilityLabel={destination.label}>
              <View style={styles.destPill}><Text style={styles.destText} numberOfLines={1}>{destination.label}</Text></View>
              <View style={styles.destStem} />
              <View style={styles.destDot} />
            </View>
          </Marker>
        ) : null}

        {showUserLocation ? <UserLocation accuracy animated /> : null}
      </Map>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dest: { alignItems: 'center' },
  destPill: { backgroundColor: palette.navy900, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 },
  destText: { color: palette.white, fontWeight: '800', fontSize: 12 },
  destStem: { width: 2, height: 12, backgroundColor: palette.navy900 },
  destDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.navy900 },
});
