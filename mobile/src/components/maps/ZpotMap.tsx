import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ENV } from '../../constants/env';
import { palette } from '../../theme';
import { MapLibreMapView } from './providers/MapLibreMapView';
import type { ZpotMapHandle, ZpotMapProps } from './types';

/**
 * Map provider registry. Mapbox is the preferred production provider (BRD/TRD) but its native SDK needs
 * credentials that are not available in this environment; MapLibre Native (same rendering model, open
 * source, keyless tiles) is the active implementation. See docs/development/maps.md to enable Mapbox.
 */
export const activeMapProvider = 'maplibre' as const;
const mapboxRequestedButUnavailable = ENV.mapProvider === 'mapbox';

export const ZpotMap = forwardRef<ZpotMapHandle, ZpotMapProps>(function ZpotMap(props, ref) {
  return (
    <View style={styles.flex}>
      <MapLibreMapView ref={ref} {...props} />
      {ENV.showDevTools && mapboxRequestedButUnavailable ? (
        <View style={styles.devTag} pointerEvents="none">
          <Text style={styles.devText}>DEV · Mapbox not configured — using MapLibre fallback</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  devTag: { position: 'absolute', top: 4, alignSelf: 'center', backgroundColor: palette.amber50, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  devText: { fontSize: 11, fontWeight: '700', color: palette.amber900 },
});
