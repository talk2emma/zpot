import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette, radius, typography, useTheme } from '../../theme';
import { Icon } from '../common/Icon';

export function ParkingRuleNotice({ lines }: { lines: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {lines.map((l, i) => (
        <View key={i} style={styles.line}>
          <Icon name="chevronRight" size={16} color={colors.text} />
          <Text style={[typography.body, styles.flex, { color: colors.textBody }]}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/** “Signs on the street take priority” — shown at every parking decision point. */
export function CheckSignsNotice() {
  const { t } = useTranslation();
  return (
    <View style={styles.warn} accessibilityRole="alert">
      <Icon name="alert" color="#5C3600" size={18} />
      <Text style={[typography.meta, styles.flex, { color: '#5C3600' }]}>{t('common.checkSigns')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  line: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flex: { flex: 1 },
  warn: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: palette.amber50 },
});
