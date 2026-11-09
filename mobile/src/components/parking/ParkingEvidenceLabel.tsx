import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette, typography, useTheme } from '../../theme';
import type { ConfidenceLabel, VerificationStatus } from '../../types/api';

const STYLE: Record<VerificationStatus, { bg: string; fg: string; key: string }> = {
  verified: { bg: palette.green50, fg: palette.green900, key: 'Verified' },
  community: { bg: '#EEF1F3', fg: '#3D4C57', key: 'Community' },
  unverified: { bg: '#EEF1F3', fg: '#3D4C57', key: 'Unverified' },
};

export function ParkingEvidenceLabel({ status, confidence, isFixture }: {
  status: VerificationStatus; confidence: ConfidenceLabel; isFixture?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = STYLE[status];
  const label = status === 'verified' ? t('card.verified', { date: '' }).trim() : status === 'community'
    ? t('card.community', { date: '' }).trim() : t('card.notVerified');
  return (
    <View style={styles.row}>
      <View style={[styles.pill, { backgroundColor: s.bg }]}><Text style={[typography.badge, { color: s.fg }]}>{label}</Text></View>
      <Text style={[typography.meta, { color: colors.textMuted }]}>
        {t('details.confidence')}: {t(`details.confidence_${confidence}`)}
      </Text>
      {isFixture ? <Text style={[styles.fixture, { color: palette.amber900 }]}>{t('common.sampleData')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  pill: { height: 26, borderRadius: 13, paddingHorizontal: 10, justifyContent: 'center' },
  fixture: { fontSize: 12, fontWeight: '700' },
});
