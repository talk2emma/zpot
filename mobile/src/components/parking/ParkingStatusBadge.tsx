import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parkingColors, typography } from '../../theme';
import type { Category } from '../../types/api';

/** Category badge — distinguished by colour AND glyph AND text (never colour alone). */
const GLYPH: Record<Category | 'vacancy', string> = {
  free: '●', free_time_limited: '◆', paid: '€', restricted: '×', unknown: '?', vacancy: '●',
};

export function ParkingStatusBadge({ category, label, testID }: { category: Category | 'vacancy'; label: string; testID?: string }) {
  const c = parkingColors[category];
  const dashed = category === 'unknown';
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, dashed && styles.dashed]} testID={testID}
      accessibilityLabel={label}>
      <Text style={[styles.glyph, { color: c.fg }]} accessibilityElementsHidden>{GLYPH[category]}</Text>
      <Text style={[typography.badge, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, alignSelf: 'flex-start' },
  dashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#6B7A86' },
  glyph: { fontSize: 12, fontWeight: '800' },
});
