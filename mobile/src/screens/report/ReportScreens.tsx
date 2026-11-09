import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Banner, ConfirmDialog, EmptyState, ErrorState, FilterChip, Icon, ListRow, LoadingState, Screen, ScreenHeader, SectionLabel,
  SummaryRow, Title, Toggle, Wrap, ZpotButton, ZpotTextField,
} from '../../components/common';
import { toast } from '../../components/common/Toast';
import { PhotoField } from '../../components/forms/PhotoField';
import { ALL_LAYERS } from '../../components/maps/types';
import { ZpotMap } from '../../components/maps/ZpotMap';
import { ENV } from '../../constants/env';
import { useRequireAuth } from '../../features/shared';
import { qk, useAuthed } from '../../hooks/useAccount';
import { useAreaDetail, useSearchParams } from '../../hooks/useParking';
import type { RootScreenProps } from '../../navigation/types';
import { reportsApi } from '../../services/api';
import { ApiError } from '../../services/api/errors';
import { draftCoordinates, EPHEMERAL, useReportDraft } from '../../store/reportDraftStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, typography, useTheme } from '../../theme';
import type { Report, ReportType } from '../../types/contracts';
import { formatDate, formatTime } from '../../utils/time';

const TYPES: ReportType[] = ['leaving', 'found', 'occupied', 'incorrect_rule', 'new_sign', 'closure', 'obstruction', 'wrong_location', 'other'];
const ICONS: Record<ReportType, 'navigation' | 'check' | 'close' | 'alert' | 'flag' | 'calendar' | 'info' | 'pin' | 'help'> = {
  leaving: 'navigation', found: 'check', occupied: 'close', incorrect_rule: 'alert', new_sign: 'flag', closure: 'calendar',
  obstruction: 'info', wrong_location: 'pin', other: 'help',
};
const NEEDS_DESC: ReportType[] = ['incorrect_rule', 'new_sign', 'other', 'wrong_location', 'obstruction'];
const MAX_STEPS = 12; // 12 × 4 m ≈ 48 m (< 50 m server limit)

/** SCR: Report type. Guests may only share short-lived availability; rule reports need an account. */
export function ReportTypeScreen({ navigation, route }: RootScreenProps<'ReportType'>) {
  const { areaId, sessionId } = route.params ?? {};
  const { t } = useTranslation();
  const { colors } = useTheme();
  const authed = useAuthed();
  const requireAuth = useRequireAuth();
  const start = useReportDraft(s => s.start);
  const { center } = useSearchParams();
  const origin = useSearchStore(s => s.origin);
  const area = useAreaDetail(areaId ?? null, { duration_minutes: 60 });
  const base = area.data?.location ?? origin ?? center;

  const choose = (type: ReportType) => {
    if (!EPHEMERAL.includes(type) && !authed) {
      requireAuth('ReportType', { areaId, sessionId });
      return;
    }
    if (!base) return;
    start({ type, areaId: areaId ?? null, areaName: area.data?.name ?? '', latitude: base.latitude, longitude: base.longitude, sessionId });
    navigation.navigate('ReportLocation');
  };
  return (
    <Screen testID="report-type-screen" header={<ScreenHeader title={t('report.typeTitle')} onBack={navigation.goBack} close backLabel={t('common.close')} />}>
      {area.data ? <Text style={[typography.meta, { color: colors.textMuted }]}>{area.data.name}</Text> : null}
      {areaId && area.isLoading ? <LoadingState /> : null}
      {TYPES.map(type => (
        <ListRow key={type} icon={ICONS[type]} label={t(`report.${type}`)} testID={`report-type-${type}`}
          sub={!EPHEMERAL.includes(type) && !authed ? t('report.signInForRules') : t(`report.${type}Sub`)} onPress={() => choose(type)} />
      ))}
    </Screen>
  );
}

/** SCR: Confirm location (pin nudged in ~4 m steps, max ~50 m). */
export function ReportLocationScreen({ navigation }: RootScreenProps<'ReportLocation'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const draft = useReportDraft(s => s.draft);
  const patch = useReportDraft(s => s.patch);
  if (!draft || !draft.type) return <MissingDraft onBack={navigation.goBack} />;
  const pos = draftCoordinates(draft);
  const moved = Math.round(Math.hypot(draft.dx, draft.dy) * 4);
  const nudge = (dx: number, dy: number) => patch({
    dx: Math.max(-MAX_STEPS, Math.min(MAX_STEPS, draft.dx + dx)), dy: Math.max(-MAX_STEPS, Math.min(MAX_STEPS, draft.dy + dy)) });
  const ephemeral = EPHEMERAL.includes(draft.type);
  return (
    <Screen testID="report-location-screen" padded={false}
      header={<ScreenHeader title={t('report.locTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton label={t('report.confirmLoc')} onPress={() => navigation.navigate('ReportDetails')} testID="report-location-confirm" />}>
      <View style={styles.map}>
        <ZpotMap key={`${pos.latitude.toFixed(5)}:${pos.longitude.toFixed(5)}`} styleUrl={ENV.mapStyleUrl} center={pos} initialZoom={17.5}
          features={[]} layers={ALL_LAYERS} selectedId={null} markerLabel={() => ''} onSelect={() => undefined} testID="report-map"
          extraMarkers={[{ id: 'pin', kind: 'pin', coordinate: pos, label: t('report.locTitle') }]} />
      </View>
      <View style={styles.body}>
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t('report.fineTune')}</Text>
        <View style={styles.pad} accessibilityLabel={t('report.fineTune')}>
          <View />
          <Arrow icon="chevronUp" onPress={() => nudge(0, -1)} testID="nudge-up" label="North" />
          <View />
          <Arrow icon="chevronLeft" onPress={() => nudge(-1, 0)} testID="nudge-left" label="West" />
          <View style={styles.center}><Icon name="crosshair" color={colors.textMuted} /></View>
          <Arrow icon="chevronRight" onPress={() => nudge(1, 0)} testID="nudge-right" label="East" />
          <View />
          <Arrow icon="chevronDown" onPress={() => nudge(0, 1)} testID="nudge-down" label="South" />
          <View />
        </View>
        {moved ? <Text style={[typography.meta, { color: colors.textBody }]} testID="report-moved">{t('report.moved', { m: moved })}</Text> : null}
        {!ephemeral ? (
          <>
            <SectionLabel>{t('report.aboutTitle')}</SectionLabel>
            <Wrap>
              <FilterChip label={t('report.onePosition')} selected={draft.scope === 'spot'} onPress={() => patch({ scope: 'spot' })} testID="scope-spot" />
              <FilterChip label={t('report.wholeStreet')} selected={draft.scope === 'segment'} onPress={() => patch({ scope: 'segment' })} testID="scope-segment" />
            </Wrap>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function Arrow({ icon, onPress, testID, label }: { icon: 'chevronUp' | 'chevronDown' | 'chevronLeft' | 'chevronRight'; onPress: () => void; testID: string; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.arrow, { borderColor: colors.border }, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} color={colors.text} />
    </Pressable>
  );
}

function MissingDraft({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen header={<ScreenHeader onBack={onBack} backLabel={t('common.back')} />}>
      <EmptyState icon="flag" title={t('report.discarded')} />
    </Screen>
  );
}

function detailErrors(d: NonNullable<ReturnType<typeof useReportDraft.getState>['draft']>, t: (k: string) => string) {
  const e: Record<string, string> = {};
  if (d.type === 'leaving' && !d.details.confirm) e.confirm = t('report.confirmLeaving');
  if (d.type === 'incorrect_rule' && !d.details.issue) e.issue = t('report.whatWrong');
  if (d.type === 'closure' && !d.details.until) e.until = t('report.howLong');
  if (d.type && NEEDS_DESC.includes(d.type) && d.description.trim().length < 10) e.description = t('report.describeErr');
  return e;
}

/** SCR: Add details (type-specific fields, optional/recommended photo). */
export function ReportDetailsScreen({ navigation }: RootScreenProps<'ReportDetails'>) {
  const { t } = useTranslation();
  const draft = useReportDraft(s => s.draft);
  const patch = useReportDraft(s => s.patch);
  const [touched, setTouched] = useState(false);
  if (!draft || !draft.type) return <MissingDraft onBack={navigation.goBack} />;
  const errs = detailErrors(draft, t);
  const ok = Object.keys(errs).length === 0;
  const type = draft.type;
  const photoAllowed = !EPHEMERAL.includes(type);
  const chips = (field: 'issue' | 'until' | 'spot_size', opts: string[], prefix: string) => (
    <Wrap>
      {opts.map(o => (
        <FilterChip key={o} label={t(`report.${prefix}${o}`)} selected={draft.details[field] === o} testID={`detail-${field}-${o}`}
          onPress={() => patch({ details: { [field]: draft.details[field] === o ? undefined : o } })} />
      ))}
    </Wrap>
  );
  return (
    <Screen testID="report-details-screen" header={<ScreenHeader title={t('report.detailsTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton label={t('report.review')} onPress={() => (ok ? navigation.navigate('ReportReview') : setTouched(true))} testID="report-details-next" />}>
      <Title size="h2">{t(`report.${type}`)}</Title>
      {type === 'leaving' ? (
        <Toggle value={!!draft.details.confirm} onValueChange={v => patch({ details: { confirm: v } })} label={t('report.confirmLeaving')} testID="detail-confirm" />
      ) : null}
      {type === 'leaving' || type === 'found' ? (<><SectionLabel>{t('report.spotSize')}</SectionLabel>{chips('spot_size', ['small', 'standard', 'large'], '')}</>) : null}
      {type === 'incorrect_rule' ? (<><SectionLabel>{t('report.whatWrong')}</SectionLabel>{chips('issue', ['hours', 'price', 'not_free', 'permit', 'other'], 'issue_')}</>) : null}
      {type === 'closure' ? (<><SectionLabel>{t('report.howLong')}</SectionLabel>{chips('until', ['today', 'few_days', 'not_sure'], 'until_')}</>) : null}
      {!EPHEMERAL.includes(type) || type === 'occupied' ? (
        <ZpotTextField label={type === 'closure' || type === 'occupied' ? t('report.describeClosure') : t('report.describe')} multiline
          value={draft.description} onChangeText={description => patch({ description })} maxLength={1000} testID="detail-description"
          error={touched ? errs.description : undefined} />
      ) : null}
      {photoAllowed ? (
        <PhotoField value={draft.photo} onChange={photo => patch({ photo })} testID="report-photo"
          label={t('report.photo', { req: type === 'new_sign' ? t('report.recommended') : t('report.optional') })} />
      ) : null}
      {touched && !ok ? <Banner tone="error" testID="report-details-error">{Object.values(errs).join(' · ')}</Banner> : null}
    </Screen>
  );
}

/** SCR: Review and submit (with discard confirmation; draft survives offline). */
export function ReportReviewScreen({ navigation }: RootScreenProps<'ReportReview'>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const draft = useReportDraft(s => s.draft);
  const clear = useReportDraft(s => s.clear);
  const origin = useSearchStore(s => s.origin);
  const [cancel, setCancel] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      const d = useReportDraft.getState().draft!;
      const pos = draftCoordinates(d);
      const details = Object.fromEntries(Object.entries(d.details).filter(([, v]) => v !== undefined && v !== ''));
      const report = await reportsApi.create({ type: d.type!, latitude: pos.latitude, longitude: pos.longitude, area_id: d.areaId,
        scope: d.scope, details, description: d.description.trim(),
        ...(origin ? { device_latitude: origin.latitude, device_longitude: origin.longitude } : {}) });
      let photoFailed = false;
      if (d.photo) {
        try { setPct(0); await reportsApi.uploadPhoto(report.id, d.photo, f => setPct(Math.round(f * 100))); } catch { photoFailed = true; }
      }
      return { report, photoFailed };
    },
    onSuccess: ({ report, photoFailed }) => {
      clear();
      void qc.invalidateQueries({ queryKey: qk.myReports });
      void qc.invalidateQueries({ queryKey: ['availability'] });
      navigation.replace('ReportSuccess', { id: report.id, photoFailed });
    },
  });
  if (!draft || !draft.type) return <MissingDraft onBack={navigation.goBack} />;
  const err = submit.error instanceof ApiError ? submit.error : null;
  const pos = draftCoordinates(draft);
  return (
    <Screen testID="report-review-screen" header={<ScreenHeader title={t('report.reviewTitle')} onBack={navigation.goBack} backLabel={t('common.back')}
      right={<ZpotButton variant="tertiary" label={t('common.cancel')} onPress={() => setCancel(true)} testID="report-cancel" />} />}
      footer={<ZpotButton label={submit.isPending ? (pct != null ? t('report.uploading', { pct }) : t('report.sending')) : t('report.submit')}
        loading={submit.isPending} onPress={() => submit.mutate()} testID="report-submit" />}>
      <SummaryRow k={t('report.type')} v={t(`report.${draft.type}`)} />
      <SummaryRow k={t('report.where')} v={draft.areaName || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`} />
      {!EPHEMERAL.includes(draft.type) ? <SummaryRow k={t('report.aboutTitle')} v={t(draft.scope === 'spot' ? 'report.onePosition' : 'report.wholeStreet')} /> : null}
      {draft.description ? <SummaryRow k={t('report.describe')} v={draft.description} /> : null}
      {draft.photo ? <SummaryRow k={t('report.photo', { req: '' })} v="✓" /> : null}
      <SummaryRow k={t('report.published')} v={EPHEMERAL.includes(draft.type) ? t('report.pubNow') : t('report.pubReview')} />
      {err?.isOffline ? <Banner tone="warn" testID="report-offline">{t('report.draftKept')}</Banner>
        : submit.error ? <ErrorState error={submit.error} testID="report-error" /> : null}
      <ConfirmDialog visible={cancel} title={t('report.cancelQ')} body={t('report.cancelBody')} confirmLabel={t('report.discard')} destructive
        cancelLabel={t('report.keepEditing')} onCancel={() => setCancel(false)} testID="report-cancel-dialog"
        onConfirm={() => { setCancel(false); clear(); toast(t('report.discarded')); navigation.navigate('Main', { screen: 'Explore' }); }} />
    </Screen>
  );
}

function nextStep(r: Report, t: (k: string) => string) {
  if (r.status === 'published') return t('report.nextEph');
  if (EPHEMERAL.includes(r.type)) return t('report.lowTrust');
  return t('report.nextReview');
}

/** SCR: Report received. */
export function ReportSuccessScreen({ navigation, route }: RootScreenProps<'ReportSuccess'>) {
  const { id, photoFailed } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['report', id], queryFn: () => reportsApi.get(id) });
  const done = () => navigation.navigate('Main', { screen: 'Explore' });
  return (
    <Screen testID="report-success-screen" header={<ScreenHeader onBack={done} close backLabel={t('common.close')} />}
      footer={<>
        <ZpotButton label={t('report.done')} onPress={done} testID="report-success-done" />
        <ZpotButton variant="tertiary" label={t('report.myReports')} onPress={() => navigation.replace('MyReports')} testID="report-success-mine" />
      </>}>
      <View style={[styles.ok, { backgroundColor: palette.green50 }]}><Icon name="check" size={30} color={palette.green700} /></View>
      <Title>{t('report.successTitle')}</Title>
      {q.data ? (
        <>
          <Text style={[typography.bodyStrong, { color: colors.text }]} testID="report-reference">{t('report.reference', { ref: q.data.reference })}</Text>
          <Text style={[typography.body, { color: colors.textBody }]} testID="report-next">{nextStep(q.data, t)}</Text>
        </>
      ) : q.isLoading ? <LoadingState /> : null}
      {photoFailed ? <Banner tone="warn" testID="report-photo-failed">{t('report.photoFailed')}</Banner> : null}
    </Screen>
  );
}

/** SCR: My reports (account, or this device for guests). */
export function MyReportsScreen({ navigation }: RootScreenProps<'MyReports'>) {
  const { t, i18n } = useTranslation();
  const authed = useAuthed();
  const q = useQuery({ queryKey: qk.myReports, queryFn: reportsApi.mine });
  const items = q.data?.results ?? [];
  return (
    <Screen testID="my-reports-screen" header={<ScreenHeader title={t('report.myReports')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {!authed ? <Banner tone="info">{t('report.guestNote')}</Banner> : null}
      {q.isLoading ? <LoadingState skeleton={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : items.length === 0 ? <EmptyState icon="flag" title={t('report.myReports')} body={t('report.emptyMine')} /> : null}
      {items.map(r => (
        <ListRow key={r.id} icon={ICONS[r.type]} label={t(`report.${r.type}`)} testID={`my-report-${r.reference}`}
          sub={`${r.reference} · ${formatDate(r.created_at, i18n.language)} ${formatTime(r.created_at)}`}
          value={t(`report.st_${r.status}`)} onPress={() => navigation.navigate('ReportDetail', { id: r.id })} />
      ))}
    </Screen>
  );
}

/** SCR: Report detail with status history, rejection reason, appeal and photo retry. */
export function ReportDetailScreen({ navigation, route }: RootScreenProps<'ReportDetail'>) {
  const { id } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const authed = useAuthed();
  const q = useQuery({ queryKey: ['report', id], queryFn: () => reportsApi.get(id) });
  const [msg, setMsg] = useState('');
  const appeal = useMutation({ mutationFn: () => reportsApi.appeal(id, msg.trim()), onSuccess: r => {
    qc.setQueryData(['report', id], r); void qc.invalidateQueries({ queryKey: qk.myReports }); setMsg(''); toast(t('report.appealSent'));
  } });
  const [photo, setPhoto] = useState<Parameters<typeof reportsApi.uploadPhoto>[1] | null>(null);
  const upload = useMutation({ mutationFn: () => reportsApi.uploadPhoto(id, photo!), onSuccess: () => { setPhoto(null); void q.refetch(); } });
  const r = q.data;
  if (!r) {
    return <Screen header={<ScreenHeader onBack={navigation.goBack} />}>{q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}</Screen>;
  }
  const history = r.history as { event: string; at: string; reason?: string }[];
  const canAppeal = authed && r.status === 'rejected' && !r.appeal;
  const canAddPhoto = authed && !EPHEMERAL.includes(r.type) && r.attachments.length === 0 && ['pending_review', 'under_review'].includes(r.status);
  return (
    <Screen testID="report-detail-screen" header={<ScreenHeader title={t('report.detailTitle', { ref: r.reference })} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <Title size="h2">{t(`report.${r.type}`)}</Title>
      <SummaryRow k={t('support.topic')} v={t(`report.st_${r.status}`)} />
      {(r.area as { name?: string } | null)?.name ? <SummaryRow k={t('report.where')} v={(r.area as { name: string }).name} /> : null}
      {r.description ? <Text style={[typography.body, { color: colors.textBody }]}>{r.description}</Text> : null}
      {r.rejection_reason ? <Banner tone="warn" testID="report-rejection">{`${t('report.reason')}: ${r.rejection_reason}`}</Banner> : null}
      <SectionLabel>{t('report.history')}</SectionLabel>
      {history.map((h, i) => (
        <View key={`${h.event}-${i}`} style={[styles.ev, { borderLeftColor: colors.border }]}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t(`report.ev_${h.event}`, { defaultValue: h.event })}</Text>
          <Text style={[typography.meta, { color: colors.textMuted }]}>{`${formatDate(h.at, i18n.language)} ${formatTime(h.at)}`}{h.reason ? ` · ${h.reason}` : ''}</Text>
        </View>
      ))}
      {canAddPhoto ? (
        <>
          <PhotoField value={photo} onChange={setPhoto} label={t('report.photo', { req: t('report.optional') })} testID="detail-photo" />
          {photo ? <ZpotButton label={t('report.submit')} loading={upload.isPending} onPress={() => upload.mutate()} testID="detail-photo-upload" /> : null}
          {upload.error ? <ErrorState error={upload.error} /> : null}
        </>
      ) : null}
      {canAppeal ? (
        <>
          <SectionLabel>{t('report.appealTitle')}</SectionLabel>
          <ZpotTextField label={t('report.appealPh')} value={msg} onChangeText={setMsg} multiline maxLength={1000} testID="appeal-message" />
          <ZpotButton label={t('report.sendAppeal')} disabled={msg.trim().length < 10} loading={appeal.isPending} onPress={() => appeal.mutate()} testID="appeal-send" />
          {appeal.error ? <ErrorState error={appeal.error} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 260 },
  body: { padding: 20, gap: 12 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 56, alignSelf: 'center' },
  arrow: { width: 52, height: 52, margin: 2, borderWidth: 1.5, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  center: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ok: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  ev: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 4, gap: 2 },
});
