import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Banner, ErrorState, Icon, type IconName, LoadingState, Screen, SectionLabel, SummaryRow, ZpotButton } from '../../components/common';
import { ALL_LAYERS } from '../../components/maps/types';
import { ZpotMap } from '../../components/maps/ZpotMap';
import { ParkingEvidenceLabel } from '../../components/parking/ParkingEvidenceLabel';
import { CheckSignsNotice, ParkingRuleNotice } from '../../components/parking/ParkingRuleNotice';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { ENV } from '../../constants/env';
import { describeOption, markerLabel } from '../../features/parking/presentation';
import { useRequireAuth } from '../../features/shared';
import { useSaveLocation } from '../account/AccountScreens';
import { useAreaDetail, useSearchParams } from '../../hooks/useParking';
import type { RootScreenProps } from '../../navigation/types';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, shadows, typography, useTheme } from '../../theme';
import { formatDate } from '../../utils/time';
import { AreaAvailability } from '../explore/VerificationPanel';

export function ParkingDetailsScreen({ navigation, route }: RootScreenProps<'ParkingDetails'>) {
  const { id } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { params, center } = useSearchParams();
  const { plan, destination, select, setView } = useSearchStore();
  const stay = { arrival_at: params?.arrival_at, duration_minutes: params?.duration_minutes ?? plan.durationHours * 60,
    vehicle_class: params?.vehicle_class, permit_type: params?.permit_type, has_disabled_badge: params?.has_disabled_badge,
    latitude: center?.latitude, longitude: center?.longitude };
  const q = useAreaDetail(id, stay);
  const [verifOpen, setVerifOpen] = useState(false);
  const requireAuth = useRequireAuth();
  const saveLoc = useSaveLocation();
  const a = q.data;

  const feature = useMemo(() => a ? [{ type: 'Feature' as const, geometry: a.geometry,
    properties: { id: a.id, name: a.name, category: a.category, layer: 'free' as const, kind: a.kind, rate_per_hour: null,
      leave_by: a.leave_by, latitude: a.location.latitude, longitude: a.location.longitude, availability_status: a.availability_status } }] : [], [a]);

  if (!a) {
    return (
      <Screen testID="details-screen" header={<HeaderButtons onBack={navigation.goBack} />}>
        {q.isLoading ? <LoadingState skeleton={3} /> : <ErrorState error={q.error} title={t('details.loadError')} onRetry={() => void q.refetch()} />}
      </Screen>
    );
  }

  const d = describeOption(a, t, i18n.language);
  const border = { restricted: palette.red500, unknown: palette.slate300, paid: palette.blue400 }[a.category as string] ?? palette.green500;
  const when = plan.useNow ? t('details.now') : `${String(plan.hour).padStart(2, '0')}:00`;
  const blockedCode = a.blocking_reason?.code;
  const detailLine = a.category === 'restricted' ? a.blocking_reason?.label
    : a.leave_by_reason ? `${a.leave_by_reason.label} · ${d.limitText}` : undefined;
  const navTo = () => navigation.navigate('NavigationPicker', { id: a.id, name: a.name, latitude: a.location.latitude, longitude: a.location.longitude });
  const share = () => void Share.share({ message: `${a.name} — Zpot\nzpot://parking/${a.id}\nhttps://maps.google.com/?q=${a.location.latitude},${a.location.longitude}` });
  const viewOnMap = () => { select(a.id); setView('map'); navigation.navigate('Main', { screen: 'Explore' }); };

  return (
    <Screen testID="details-screen" padded={false}
      footer={<View style={styles.row}>
        <ZpotButton style={styles.flex} variant="secondary" label={t('details.parkedHere')} disabled={a.category === 'restricted'}
          onPress={() => requireAuth('StartSession', { areaId: a.id })} testID="details-parked" />
        <ZpotButton style={styles.flex} icon="navigation" label={t('details.navigate')} onPress={navTo} testID="details-navigate" />
      </View>}>
      <View style={styles.hero}>
        <ZpotMap styleUrl={ENV.mapStyleUrl} center={a.location} initialZoom={16.2} features={feature} layers={ALL_LAYERS}
          selectedId={a.id} markerLabel={p => markerLabel(p.category, t, { lang: i18n.language, leaveBy: p.leave_by })}
          destination={destination ? { label: destination.name, coordinate: destination } : null} onSelect={() => undefined} testID="details-map" />
        <View style={[styles.heroBar, { top: insets.top + 6 }]} pointerEvents="box-none">
          <RoundBtn icon="chevronLeft" label={t('common.back')} onPress={navigation.goBack} testID="details-back" />
          <View style={styles.flex} />
          <RoundBtn icon="share" label={t('details.share')} onPress={share} testID="details-share" />
          <RoundBtn icon="bookmark" label={t('details.save')} onPress={() => void saveLoc.save({ id: a.id, name: a.name, category: a.category })} testID="details-save" />
        </View>
      </View>
      <View style={styles.body}>
        <ParkingStatusBadge category={a.category} label={d.badge} testID="details-badge" />
        <Text style={[typography.h1, { color: colors.text }]} accessibilityRole="header" testID="details-name">{a.name}</Text>
        <Text style={[typography.meta, { color: colors.textMuted }]}>
          {t('details.walkFrom', { place: a.supported_area?.name ?? '', walk: a.walking_duration_minutes, dest: destination?.name ?? t('explore.nearYou') })}
        </Text>
        {a.category === 'restricted' ? <Banner tone="error" testID="details-cant-park">{t('details.cantPark')}</Banner> : null}
        <View style={[styles.status, { borderColor: border }]} testID="details-status">
          <Text style={[typography.label, { color: colors.textMuted }]}>{t('details.forStay', { when, dur: plan.durationHours })}</Text>
          <Text style={[typography.h2, { color: colors.text }]}>{d.headline}</Text>
          {detailLine ? <Text style={[typography.body, { color: colors.textBody }]}>{detailLine}</Text> : null}
          {blockedCode === 'permit_required' || blockedCode === 'badge_required'
            ? <Text style={[typography.meta, { color: colors.textMuted }]}>{t(`headline.${blockedCode}`)}</Text> : null}
        </View>
        <View style={styles.grid}>
          <Cell k={t('details.costForStay')} v={a.category === 'restricted' ? '—' : a.category === 'unknown' ? t('card.costUnknown') : d.costText.replace(/ total| no total/, '')} />
          <Cell k={t('details.timeLimit')} v={d.leaveBy ? t('card.leaveBy', { time: d.leaveBy }) : t('card.noLimit')} />
          <Cell k={t('details.walkTo')} v={d.walkText} />
          <Cell k={t('details.availability')} v={a.availability_status === 'recently_reported_available' ? t('details.recentlyReported') : t('details.notConfirmed')} />
        </View>
        <SectionLabel>{t('details.rulesTitle')}</SectionLabel>
        <ParkingRuleNotice lines={a.rule_lines} />
        <CheckSignsNotice />
        <Pressable onPress={() => setVerifOpen(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: verifOpen }}
          style={[styles.verif, { borderColor: colors.border }]} testID="details-verification-toggle">
          <View style={styles.flex}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('details.verification')}</Text>
            <ParkingEvidenceLabel status={a.verification_status} confidence={a.confidence_label} isFixture={a.data_source?.is_development_fixture} />
          </View>
          <Icon name={verifOpen ? 'chevronUp' : 'chevronDown'} color={colors.text} />
        </Pressable>
        {verifOpen ? (
          <View testID="details-verification">
            <SummaryRow k={t('details.source')} v={a.data_source?.name ?? '—'} />
            <SummaryRow k={t('details.lastVerified')} v={a.verified_at ? formatDate(a.verified_at, i18n.language) : t('details.never')} />
            <SummaryRow k={t('details.evidence')} v={t(`details.evidence_${a.evidence_status}`, { defaultValue: a.evidence_status })} />
            <SummaryRow k={t('details.confidence')} v={t(`details.confidence_${a.confidence_label}`)} />
            {a.data_source?.is_development_fixture ? <Text style={[typography.meta, { color: palette.amber900 }]}>{t('details.devFixture')}</Text> : null}
          </View>
        ) : null}
        {a.commercial ? (
          <View style={[styles.partner, { backgroundColor: colors.surfaceMuted }]} testID="details-partner">
            <Text style={[typography.label, { color: colors.textMuted }]}>{t('details.partnerTitle')}</Text>
            {a.commercial.offer ? <Text style={[typography.body, { color: colors.textBody }]}>{a.commercial.offer}</Text> : null}
            {a.commercial.ev_charging ? <Text style={[typography.meta, { color: colors.textMuted }]}>EV: {a.commercial.ev_charging}</Text> : null}
            <Text style={[typography.meta, { color: colors.textMuted }]}>{t('details.partnerDisclosure')}</Text>
            <ZpotButton variant="small" label={t('partner.view')} onPress={() => navigation.navigate('Partner', { areaId: a.id })} testID="details-partner" />
          </View>
        ) : null}
        <AreaAvailability areaId={a.id} />
        {saveLoc.sheet}
        <View style={styles.links}>
          <ZpotButton variant="small" icon="map" label={t('details.viewOnMap')} onPress={viewOnMap} testID="details-view-map" />
          <ZpotButton variant="small" icon="flag" label={t('details.report')} onPress={() => navigation.navigate('ReportType', { areaId: a.id })} testID="details-report" />
        </View>
      </View>
    </Screen>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.cell, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{k}</Text>
      <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 17 }]}>{v}</Text>
    </View>
  );
}

function RoundBtn({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} style={[styles.round, shadows.card]}>
      <Icon name={icon} color={palette.navy900} />
    </Pressable>
  );
}

function HeaderButtons({ onBack }: { onBack: () => void }) {
  return <View style={styles.headerBtns}><RoundBtn icon="chevronLeft" label="Back" onPress={onBack} testID="details-back" /></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  hero: { height: 190, backgroundColor: palette.slate50 },
  heroBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 8 },
  round: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center' },
  headerBtns: { paddingHorizontal: 12, paddingVertical: 6 },
  body: { padding: 20, gap: 12 },
  status: { borderWidth: 1.5, borderRadius: radius.xl, padding: 14, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1, padding: 12, borderRadius: radius.lg, gap: 2 },
  verif: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.xl, padding: 14 },
  partner: { padding: 14, borderRadius: radius.lg, gap: 6 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
