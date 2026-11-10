import React, { forwardRef, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ENV } from '../../constants/env';
import { palette } from '../../theme';
import { MapboxMapView } from './providers/MapboxMapView';
import type { ZpotMapHandle, ZpotMapProps } from './types';

/**
 * Map provider: Mapbox Maps SDK v11 via @rnmapbox/maps (BRD/TRD). It needs a public pk.* token
 * (ZPOT_MAPBOX_PUBLIC_TOKEN). Without one the map is honestly reported as unavailable — screens fall back to
 * their list views through onMapError — rather than rendering a blank or fake map. See docs/development/maps.md.
 */
export const ZpotMap = forwardRef<ZpotMapHandle, ZpotMapProps>(function ZpotMap(props, ref) {
  const { t } = useTranslation();
  const configured = ENV.mapboxConfigured;
  const onMapError = useRef(props.onMapError);
  onMapError.current = props.onMapError;
  // Report once per mount (screens usually pass inline callbacks).
  useEffect(() => { if (!configured) onMapError.current?.(); }, [configured]);

  if (!configured) {
    return (
      <View style={[styles.flex, styles.unavailable]} testID={props.testID} accessibilityRole="text">
        <Text style={styles.unavailableText}>{t('explore.mapNotConfigured')}</Text>
        {ENV.showDevTools ? <Text style={styles.devText}>DEV · set ZPOT_MAPBOX_PUBLIC_TOKEN=pk.… in mobile/.env</Text> : null}
      </View>
    );
  }
  return <MapboxMapView ref={ref} {...props} />;
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  unavailable: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, backgroundColor: palette.amber50 },
  unavailableText: { fontSize: 14, fontWeight: '700', color: palette.amber900, textAlign: 'center' },
  devText: { fontSize: 11, fontWeight: '700', color: palette.amber900 },
});
