import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Icon, Row, ZpotButton } from '../../components/common';
import { errorMessage } from '../../components/common/States';
import type { ExtraMarker } from '../../components/maps/types';
import { availabilityApi, reportsApi } from '../../services/api';
import { palette, radius, shadows, typography, useTheme } from '../../theme';
import type { LatLng } from '../../types/api';
import type { Observation, VerificationAnswer } from '../../types/contracts';

/** Live community vacancy reports near a point. Expiry is enforced by the server on every read. */
export function useNearbyVacancies(center: LatLng | null) {
  return useQuery({
    queryKey: ['availability', 'nearby', center ? `${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}` : 'none'],
    queryFn: ({ signal }) => availabilityApi.nearby(center!.latitude, center!.longitude, 900, signal),
    enabled: !!center, refetchInterval: 60_000, staleTime: 30_000,
  });
}

export function vacancyMarkers(obs: Observation[] | undefined, label: (o: Observation) => string, onPress: (o: Observation) => void): ExtraMarker[] {
  return (obs ?? []).filter(o => o.kind !== 'occupied' && o.state !== 'observation_expired').map(o => ({
    id: `obs-${o.id}`, kind: o.state === 'conflicting_reports' ? 'conflict' : 'vacancy',
    coordinate: o.location as unknown as LatLng, label: label(o), onPress: () => onPress(o),
  }));
}

/** "Is this spot still available?" — availability is shown separately from the parking rule. */
export function VacancyCard({ obs, onClose, testID = 'vacancy-panel' }: { obs: Observation; onClose?: () => void; testID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [answered, setAnswered] = useState<VerificationAnswer | null>(null);
  const verify = useMutation({
    mutationFn: (a: VerificationAnswer) => reportsApi.verify(obs.report_id!, a),
    onSuccess: (_r, a) => { setAnswered(a); void qc.invalidateQueries({ queryKey: ['availability'] }); },
  });
  const conflict = obs.state === 'conflicting_reports';
  const own = verify.error && (verify.error as { code?: string }).code === 'own_observation';
  return (
    <View style={[styles.card, shadows.card, { backgroundColor: colors.surface }]} testID={testID}>
      <Row>
        <View style={[styles.badge, { backgroundColor: conflict ? palette.amber50 : palette.green50 }]}>
          <Text style={[styles.badgeText, { color: conflict ? palette.amber900 : palette.green700 }]}>{conflict ? t('verify.conflict') : t('verify.vacancy')}</Text>
        </View>
        <View style={styles.flex} />
        {onClose ? <ZpotButton variant="tertiary" label={t('common.close')} onPress={onClose} testID={`${testID}-close`} /> : null}
      </Row>
      {obs.area_name ? <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('verify.near', { place: obs.area_name })}</Text> : null}
      <Text style={[typography.meta, { color: colors.textMuted }]}>
        {[t('verify.reportedAgo', { n: obs.age_minutes }), obs.confirmations ? t('verify.byDrivers', { count: obs.confirmations }) : null,
          obs.contradictions ? t('verify.saidTaken', { n: obs.contradictions }) : null, t('verify.fades')].filter(Boolean).join(' · ')}
      </Text>
      {conflict ? <Text style={[typography.meta, { color: colors.textBody }]}>{t('verify.conflictBody')}</Text> : null}
      <Text style={[typography.small, { color: colors.textSubtle }]}>{t('verify.notGuaranteed')}</Text>
      {answered ? (
        <Banner tone="ok" testID={`${testID}-thanks`}>{t(answered === 'still_available' ? 'verify.thanksYes' : answered === 'taken' ? 'verify.thanksNo' : 'verify.thanksUnsure')}</Banner>
      ) : obs.report_id ? (
        <>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('verify.still')}</Text>
          <Row gap={8}>
            <ZpotButton variant="small" label={t('verify.yes')} onPress={() => verify.mutate('still_available')} testID={`${testID}-yes`} disabled={verify.isPending} />
            <ZpotButton variant="small" label={t('verify.no')} onPress={() => verify.mutate('taken')} testID={`${testID}-no`} disabled={verify.isPending} />
            <ZpotButton variant="small" label={t('verify.unsure')} onPress={() => verify.mutate('unsure')} testID={`${testID}-unsure`} disabled={verify.isPending} />
          </Row>
        </>
      ) : null}
      {verify.error ? (
        (verify.error as { code?: string }).code === 'observation_expired'
          ? <Banner tone="info" testID={`${testID}-expired`}>{`${t('verify.expired')} — ${t('verify.expiredBody')}`}</Banner>
          : <Banner tone={own ? 'info' : 'error'}>{own ? t('verify.own') : errorMessage(verify.error, t)}</Banner>
      ) : null}
    </View>
  );
}

/** On parking details: recent community availability for this area (separate from the rule). */
export function AreaAvailability({ areaId }: { areaId: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['availability', 'area', areaId], queryFn: () => availabilityApi.forArea(areaId), refetchInterval: 60_000 });
  const live = (q.data ?? []).filter(o => o.kind !== 'occupied' && o.state !== 'observation_expired');
  if (!live.length) return null;
  return (
    <View style={styles.col} testID="details-availability">
      <Row gap={6}><Icon name="info" size={16} color={colors.textMuted} /><Text style={[typography.label, { color: colors.textMuted }]}>{t('verify.ruleSep')}</Text></Row>
      {live.slice(0, 2).map(o => <VacancyCard key={o.id} obs={o} testID={`details-vacancy-${o.id}`} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  col: { gap: 8 },
  card: { borderRadius: radius.xl, padding: 14, gap: 6 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
