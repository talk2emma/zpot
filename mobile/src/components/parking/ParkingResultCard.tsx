import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { describeOption } from '../../features/parking/presentation';
import { palette, typography, useTheme } from '../../theme';
import type { ParkingOption } from '../../types/api';
import { ZpotCard } from '../common/ZpotCard';
import { ParkingStatusBadge } from './ParkingStatusBadge';

export function ParkingResultCard({ option, onPress, recommended, selected }: {
  option: ParkingOption; onPress: () => void; recommended?: boolean; selected?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const d = describeOption(option, t, i18n.language);
  const a11y = [recommended ? t('explore.recommended') : '', option.name, d.badge, d.headline, d.walkText, d.costText, d.freshText]
    .filter(Boolean).join(', ');
  return (
    <ZpotCard onPress={onPress} testID={`result-card-${option.id}`} accessibilityLabel={a11y}
      highlight={recommended ? palette.green500 : selected ? palette.navy900 : undefined}
      style={recommended ? { backgroundColor: palette.green25 } : undefined}>
      {recommended ? (
        <View style={styles.top}>
          <Text style={[typography.label, { color: palette.green900 }]}>{t('explore.recommended')}</Text>
          <ParkingStatusBadge category={option.category} label={d.badge} />
        </View>
      ) : null}
      <View style={styles.top}>
        <Text style={[typography.h2, styles.name, { color: colors.text }]} numberOfLines={2}>{option.name}</Text>
        {!recommended ? <ParkingStatusBadge category={option.category} label={d.badge} /> : null}
      </View>
      {recommended ? (
        <Text style={[typography.body, { color: colors.textBody }]}>{`${d.headline} · ${d.walkText} · ${t('explore.availabilityNotConfirmed')}`}</Text>
      ) : (
        <>
          <Text style={[typography.body, { color: colors.textBody }]}>{d.headline}</Text>
          <View style={styles.meta}>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{d.walkText}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{d.costText}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{d.limitText}</Text>
          </View>
          <Text style={[styles.fresh, { color: colors.textMuted }]}>{d.freshText}</Text>
        </>
      )}
      {option.commercial ? <Text style={[styles.fresh, { color: colors.textMuted }]}>{t('card.sponsoredPartner')}</Text> : null}
    </ZpotCard>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  name: { flex: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, marginTop: 4 },
  fresh: { fontSize: 13, marginTop: 6 },
});
