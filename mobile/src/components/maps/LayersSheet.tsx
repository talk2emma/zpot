import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette, radius, typography, useTheme } from '../../theme';
import { BottomSheet } from '../common/BottomSheet';
import { Toggle } from '../common/Primitives';
import { ParkingMapMarker } from '../parking/ParkingMapMarker';
import type { LayerKey } from './types';

const ROWS: { key: LayerKey; cat: 'free' | 'free_time_limited' | 'paid' | 'restricted' | 'unknown'; sample: string }[] = [
  { key: 'free', cat: 'free', sample: 'Free' },
  { key: 'timed', cat: 'free_time_limited', sample: '◆' },
  { key: 'paid', cat: 'paid', sample: '€/h' },
  { key: 'restrict', cat: 'restricted', sample: '×' },
  { key: 'unknown', cat: 'unknown', sample: '?' },
];

export function LayersSheet({ visible, onClose, layers, onToggle }: {
  visible: boolean; onClose: () => void; layers: Record<LayerKey, boolean>; onToggle: (k: LayerKey) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('layers.title')} testID="layers-sheet" closeLabel={t('common.close')}>
      {ROWS.map(r => (
        <View key={r.key} style={styles.row}>
          <ParkingMapMarker category={r.cat} label={r.sample} />
          <View style={styles.flex}>
            <Toggle value={layers[r.key]} onValueChange={() => onToggle(r.key)} label={t(`layers.${r.key}`)}
              sub={t(`layers.${r.key}D`)} testID={`layer-toggle-${r.key}`} />
          </View>
        </View>
      ))}
      <View style={[styles.conf, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('layers.confTitle')}</Text>
        <Text style={[typography.meta, { color: colors.textBody }]}>{t('layers.confBody')}</Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  conf: { padding: 14, borderRadius: radius.lg, gap: 4, borderColor: palette.slate150 },
});
