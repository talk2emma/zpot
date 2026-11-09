import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, shadows, useTheme } from '../../theme';
import { Icon, type IconName } from '../common/Icon';

function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed }) => [styles.fab, shadows.card, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} color={colors.text} />
    </Pressable>
  );
}

export function MapControls({ onLayers, onZoomIn, onZoomOut, onRecenter }: {
  onLayers: () => void; onZoomIn: () => void; onZoomOut: () => void; onRecenter: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.col}>
      <Fab icon="layers" label={t('explore.layers')} onPress={onLayers} testID="map-layers" />
      <Fab icon="plus" label={t('explore.zoomIn')} onPress={onZoomIn} testID="map-zoom-in" />
      <Fab icon="minus" label={t('explore.zoomOut')} onPress={onZoomOut} testID="map-zoom-out" />
      <Fab icon="navigation" label={t('explore.recenter')} onPress={onRecenter} testID="map-recenter" />
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 8 },
  fab: { width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
