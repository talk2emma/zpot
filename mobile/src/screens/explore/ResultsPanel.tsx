import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, EmptyState, ErrorState, LoadingState, ZpotButton } from '../../components/common';
import { ParkingResultCard } from '../../components/parking/ParkingResultCard';
import { useSearchStore } from '../../store/searchStore';
import { palette, typography, useTheme } from '../../theme';
import type { ParkingOptionsResponse } from '../../types/api';

/** Results list shared by the sheet (map view) and the list view. */
export function ResultsPanel({ data, loading, error, onRetry, placeName, bottomPad, onRefresh }: {
  data?: ParkingOptionsResponse; loading: boolean; error: unknown; onRetry: () => void; placeName: string; bottomPad: number;
  /** Pull-to-refresh: rules, prices and availability are re-evaluated by the server for the current stay. */
  onRefresh?: () => Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const pull = async () => { setRefreshing(true); try { await onRefresh?.(); } finally { setRefreshing(false); } };
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { filters, setFilters, plan, resetFilters, selectedId } = useSearchStore();
  const open = (id: number) => navigation.navigate('ParkingDetails', { id });

  if (loading && !data) return <LoadingState skeleton={3} testID="results-loading" />;
  if (error && !data) return <View style={styles.pad}><ErrorState error={error} title={t('explore.loadError')} onRetry={onRetry} testID="results-error" /></View>;
  if (!data) return null;

  if (data.coverage.status === 'unsupported') {
    return <View style={styles.pad}><Banner tone="warn" testID="coverage-unsupported">{data.coverage.note || t('explore.unsupported')}</Banner></View>;
  }

  const rec = data.results.find(r => r.is_recommended);
  // the "include time-limited free options" filter is a presentation filter over API categories
  const others = data.results.filter(r => r.id !== rec?.id && (filters.includeTimed || r.category !== 'free_time_limited'));
  const s = data.summary;
  const noFree = s.free_options === 0 && !filters.includePaid;
  const paidFallback = s.free_options === 0 && filters.includePaid && data.results.length > 0;
  const filteredEmpty = s.free_options > 0 && data.results.length === 0;
  const nextWalk = filters.maxWalk < 15 ? 15 : 20;
  const hidden: string[] = [];
  if (s.hidden.restricted) hidden.push(t('explore.hiddenRestricted', { count: s.hidden.restricted }));
  if (s.hidden.unknown) hidden.push(t('explore.hiddenUnknown', { count: s.hidden.unknown }));
  if (s.hidden.paid && s.free_options) hidden.push(t('explore.hiddenPaid', { count: s.hidden.paid }));

  return (
    <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: bottomPad }]} testID="results-list" keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={() => void pull()} tintColor={palette.green700}
        colors={[palette.green700]} testID="results-refresh" /> : undefined}>
      <View style={styles.head}>
        <Text style={[typography.h2, { color: colors.text }]} testID="results-count">
          {t('explore.options', { count: data.count, place: placeName })}
        </Text>
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t('common.sampleData')}</Text>
      </View>
      {data.coverage.note ? <Banner tone="info">{data.coverage.note}</Banner> : null}
      {loading ? <Text style={[typography.meta, { color: colors.textMuted }]}>{t('common.loading')}</Text> : null}
      {noFree || paidFallback ? (
        <EmptyState icon="info" title={t('explore.noFreeTitle')} testID="no-free-state"
          body={t('explore.noFreeWhy', { walk: filters.maxWalk, place: placeName,
            when: plan.useNow ? t('details.now') : `${plan.hour}:00`, dur: plan.durationHours })}>
          {filters.maxWalk < 20 ? (
            <ZpotButton variant="small" testID="widen-walk" onPress={() => setFilters({ maxWalk: nextWalk })}
              label={s.free_beyond_walk_limit ? t('explore.widenMore', { walk: nextWalk, count: s.free_beyond_walk_limit }) : t('explore.widen', { walk: nextWalk })} />
          ) : null}
          <ZpotButton variant="small" label={t('explore.changeTime')} onPress={() => navigation.navigate('Plan')} testID="change-time" />
          {!filters.includePaid && s.hidden.paid ? (
            <ZpotButton variant="small" label={t('explore.showPaid')} onPress={() => setFilters({ includePaid: true, freeOnly: false })} testID="show-paid" />
          ) : null}
        </EmptyState>
      ) : null}
      {filteredEmpty ? (
        <EmptyState icon="filter" title={t('explore.filteredEmpty')} testID="filtered-empty">
          <ZpotButton variant="small" label={t('explore.resetFilters')} onPress={() => resetFilters(filters.maxWalk)} />
        </EmptyState>
      ) : null}
      {rec ? <ParkingResultCard option={rec} recommended onPress={() => open(rec.id)} /> : null}
      {others.map(o => <ParkingResultCard key={o.id} option={o} selected={o.id === selectedId} onPress={() => open(o.id)} />)}
      {hidden.length ? <Text style={[typography.meta, { color: colors.textMuted }]} testID="hidden-note">{hidden.join(' · ')}</Text> : null}
      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>{t('common.checkSigns')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  disclaimer: { fontSize: 12, marginTop: 6 },
});
