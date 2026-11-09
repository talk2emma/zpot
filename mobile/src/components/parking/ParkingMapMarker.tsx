import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, parkingColors, shadows } from '../../theme';
import type { Category } from '../../types/api';

/** Pill marker drawn on the map (prototype .mk-*). Selected markers get a navy outline. */
export function ParkingMapMarker({ category, label, selected, far }: { category: Category; label: string; selected?: boolean; far?: boolean }) {
  const c = parkingColors[category];
  const border = 'border' in c ? c.border : undefined;
  return (
    <View style={[styles.mk, shadows.marker, { backgroundColor: c.marker, borderColor: border ?? 'transparent', borderWidth: border ? 2 : 0,
      borderStyle: category === 'unknown' ? 'dashed' : 'solid', opacity: far ? 0.55 : 1 },
      selected && styles.sel]}>
      <Text style={[styles.text, { color: c.markerText }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mk: { height: 30, paddingHorizontal: 10, borderRadius: 15, alignItems: 'center', justifyContent: 'center', minWidth: 30 },
  sel: { transform: [{ scale: 1.12 }], borderColor: palette.navy900, borderWidth: 3 },
  text: { fontSize: 12, fontWeight: '800' },
});
