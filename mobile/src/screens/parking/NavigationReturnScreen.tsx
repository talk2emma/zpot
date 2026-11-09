import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName, LoadingState, Screen, ScreenHeader, ZpotCard } from '../../components/common';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { describeOption } from '../../features/parking/presentation';
import { useRequireAuth } from '../../features/shared';
import { useAreaDetail, useSearchParams } from '../../hooks/useParking';
import type { RootScreenProps } from '../../navigation/types';
import { useSearchStore } from '../../store/searchStore';
import { palette, typography, useTheme } from '../../theme';

/** "Welcome back" after the external navigation app; the search and selected location are preserved. */
export function NavigationReturnScreen({ navigation }: RootScreenProps<'NavigationReturn'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { handoff, setHandoff, select } = useSearchStore();
  const { params } = useSearchParams();
  const id = handoff?.areaId ?? null;
  const q = useAreaDetail(id, { arrival_at: params?.arrival_at, duration_minutes: params?.duration_minutes ?? 120 });
  const requireAuth = useRequireAuth();
  const close = () => { setHandoff(null); navigation.navigate('Main', { screen: 'Explore' }); };
  const rows: [IconName, string, string, string, () => void][] = [
    ['check', t('nav.parked'), t('nav.parkedSub'), palette.green700, () => (id ? requireAuth('StartSession', { areaId: id }) : close())],
    ['close', t('nav.noSpace'), t('nav.noSpaceSub'), palette.red600, () => { select(null); close(); }],
    ['search', t('nav.another'), t('nav.anotherSub'), colors.text, close],
    ['flag', t('nav.wrong'), t('nav.wrongSub'), colors.text, () => navigation.replace('ReportType', { areaId: id ?? undefined })],
  ];
  return (
    <Screen testID="nav-return-screen" header={<ScreenHeader title={t('nav.returnTitle')} onBack={close} close backLabel={t('common.close')} />}>
      {q.data ? (
        <ZpotCard>
          <ParkingStatusBadge category={q.data.category} label={t(`category.${q.data.category}`)} />
          <Text style={[typography.h2, { color: colors.text, marginTop: 6 }]}>{q.data.name}</Text>
          <Text style={[typography.meta, { color: colors.textMuted }]}>{describeOption(q.data, t, i18n.language).headline}</Text>
        </ZpotCard>
      ) : id ? <LoadingState /> : null}
      <Text style={[typography.label, { color: colors.textMuted }]}>{t('nav.whatHappened')}</Text>
      {rows.map(([icon, title, sub, c, fn]) => (
        <Pressable key={title} onPress={fn} accessibilityRole="button" style={[styles.li, { borderBottomColor: colors.divider }]}>
          <Icon name={icon} color={c} />
          <View style={styles.flex}>
            <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 16 }]}>{title}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{sub}</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  li: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 64, borderBottomWidth: 1 },
  flex: { flex: 1 },
});
