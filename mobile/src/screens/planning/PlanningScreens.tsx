import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Banner, Body, ConfirmDialog, EmptyState, ErrorState, FilterChip, ListRow, LoadingState, Row, Screen, ScreenHeader, SectionLabel,
  Stepper, SummaryRow, Title, Wrap, ZpotButton, ZpotCard, ZpotTextField,
} from '../../components/common';
import { toast } from '../../components/common/Toast';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { fmtDur } from '../../features/shared';
import { useAutocomplete } from '../../hooks/useAutocomplete';
import { useAreaDetail } from '../../hooks/useParking';
import type { RootScreenProps } from '../../navigation/types';
import { authApi, billingApi, commuteApi, insightsApi, type Vehicle, vehiclesApi } from '../../services/api';
import { usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, typography, useTheme } from '../../theme';
import type { PlaceResult, VehicleClass } from '../../types/api';
import { formatEuro } from '../../utils/format';
import { formatDate, formatTime } from '../../utils/time';

const hhmmOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** SCR-057 Commute planner. The server runs the canonical search for each planned day (Free: the soonest day). */
export function CommuteScreen({ navigation }: RootScreenProps<'Commute'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const dayNames = t('p3.days', { returnObjects: true }) as unknown as string[];
  const plans = useQuery({ queryKey: ['commute'], queryFn: commuteApi.list });
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [dest, setDest] = useState<PlaceResult | null>(null);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [arrive, setArrive] = useState(9 * 60);
  const [stay, setStay] = useState(8 * 60);
  const [touched, setTouched] = useState(false);
  const ac = useAutocomplete(dest ? '' : q);
  const create = useMutation({
    mutationFn: () => commuteApi.create({ label: dest!.name, name: dest!.name, latitude: dest!.latitude, longitude: dest!.longitude,
      days, arrival_minute: arrive, duration_minutes: stay }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['commute'] }); setCreating(false); setDest(null); setQ(''); toast(t('commute.saved')); },
  });
  const err = !dest ? t('commute.pickDest') : !days.length ? t('commute.pickDay') : null;
  const list = plans.data ?? [];
  return (
    <Screen testID="commute-screen" header={<ScreenHeader title={t('commute.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={creating ? <ZpotButton label={t('commute.save')} loading={create.isPending} testID="commute-save"
        onPress={() => (err ? setTouched(true) : create.mutate())} /> : <ZpotButton variant="secondary" label={t('commute.new')} onPress={() => setCreating(true)} testID="commute-new" />}>
      <Body muted>{t('commute.intro')}</Body>
      {creating ? (
        <View style={styles.col} testID="commute-form">
          {dest ? <ListRow icon="pin" label={dest.name} sub={dest.subtitle} value={t('common.change')} onPress={() => setDest(null)} testID="commute-dest" /> : (
            <>
              <ZpotTextField label={t('commute.destination')} placeholder={t('commute.destPh')} value={q} onChangeText={setQ} testID="commute-dest-input" />
              {(ac.data ?? []).slice(0, 5).map(p => <ListRow key={p.id} icon="pin" label={p.name} sub={p.subtitle} onPress={() => setDest(p)} testID={`commute-suggestion-${p.id}`} />)}
            </>
          )}
          <SectionLabel>{t('commute.days')}</SectionLabel>
          <Wrap>{dayNames.map((d, i) => (
            <FilterChip key={d} label={d} selected={days.includes(i)} testID={`commute-day-${i}`}
              onPress={() => setDays(v => (v.includes(i) ? v.filter(x => x !== i) : [...v, i].sort()))} />
          ))}</Wrap>
          <SectionLabel>{t('commute.arrive')}</SectionLabel>
          <Stepper value={hhmmOf(arrive)} onMinus={() => setArrive(a => Math.max(0, a - 30))} onPlus={() => setArrive(a => Math.min(23 * 60 + 30, a + 30))}
            minusLabel={t('p3.minus', { n: 30 })} plusLabel={t('p3.plus', { n: 30 })} testID="commute-arrive" />
          <SectionLabel>{t('commute.stay')}</SectionLabel>
          <Stepper value={fmtDur(stay)} onMinus={() => setStay(s => Math.max(30, s - 30))} onPlus={() => setStay(s => Math.min(1440, s + 30))}
            minusLabel={t('p3.minus', { n: 30 })} plusLabel={t('p3.plus', { n: 30 })} testID="commute-stay" />
          {touched && err ? <Banner tone="error" testID="commute-error">{err}</Banner> : null}
          {create.error ? <ErrorState error={create.error} /> : null}
        </View>
      ) : null}
      <SectionLabel>{t('commute.plans')}</SectionLabel>
      {plans.isLoading ? <LoadingState /> : plans.isError ? <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
        : list.length === 0 ? <EmptyState icon="calendar" title={t('commute.plans')} body={t('commute.noPlans')} testID="commute-empty" /> : null}
      {list.map(p => <CommutePlanCard key={p.id} id={p.id} label={p.label} sub={`${p.days.map(d => dayNames[d]).join(' · ')} · ${hhmmOf(p.arrival_minute)} · ${fmtDur(p.duration_minutes)}`}
        onOpen={id => navigation.navigate('ParkingDetails', { id })} lang={i18n.language} dayNames={dayNames} />)}
      <Text style={[typography.small, { color: colors.textSubtle }]}>{t('commute.note')}</Text>
    </Screen>
  );
}

function CommutePlanCard({ id, label, sub, onOpen, lang, dayNames }: {
  id: number; label: string; sub: string; onOpen: (areaId: number) => void; lang: string; dayNames: string[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const chk = useQuery({ queryKey: ['commute-check', id], queryFn: () => commuteApi.check(id) });
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({ mutationFn: () => commuteApi.remove(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['commute'] }) });
  return (
    <ZpotCard testID={`commute-plan-${id}`}>
      <Title size="h2">{label}</Title>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{sub}</Text>
      {chk.isLoading ? <LoadingState /> : chk.isError ? <ErrorState error={chk.error} onRetry={() => void chk.refetch()} /> : null}
      {chk.data?.days.map(d => (
        <View key={d.arrival_at} style={[styles.day, { borderTopColor: colors.divider }]} testID={`commute-day-result-${id}-${d.weekday}`}>
          <Text style={[typography.label, { color: colors.textMuted }]}>{`${dayNames[d.weekday]} · ${formatDate(d.arrival_at, lang)} ${formatTime(d.arrival_at)}`}</Text>
          {d.locked ? (
            <Text style={[typography.meta, { color: colors.textMuted }]}>{`🔒 ${t('commute.locked')} — ${t('commute.lockedSub')}`}</Text>
          ) : d.best ? (
            <>
              <Text style={[typography.meta, { color: colors.textMuted }]}>{t('commute.best')}</Text>
              <Row gap={8}>
                <ParkingStatusBadge category={d.best.category as never} label={t(`category.${d.best.category}`)} />
                <Text style={[typography.bodyStrong, styles.flex, { color: colors.text }]}>{d.best.name}</Text>
              </Row>
              <Text style={[typography.meta, { color: colors.textBody }]}>
                {[d.best.expected_total_cost && Number(d.best.expected_total_cost) > 0 ? formatEuro(d.best.expected_total_cost, lang) : t('commute.free'),
                  t('commute.walk', { n: d.best.walking_duration_minutes }), d.best.leave_by ? t('commute.leaveBy', { time: formatTime(d.best.leave_by) }) : null]
                  .filter(Boolean).join(' · ')}
              </Text>
              <ZpotButton variant="tertiary" label={t('commute.open')} onPress={() => onOpen(d.best!.area_id)} testID={`commute-open-${id}`} />
            </>
          ) : <Text style={[typography.meta, { color: palette.red600 }]}>{t('commute.none')}</Text>}
        </View>
      ))}
      <ZpotButton variant="small" icon="trash" label={t('commute.remove')} onPress={() => setConfirm(true)} testID={`commute-remove-${id}`} />
      <ConfirmDialog visible={confirm} title={`${t('commute.remove')}?`} confirmLabel={t('commute.remove')} cancelLabel={t('common.cancel')} destructive
        onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); remove.mutate(); }} testID={`commute-remove-dialog-${id}`} />
    </ZpotCard>
  );
}

const CLASSES = ['car', 'van', 'motorcycle'] as const;
const PERMITS: (string | null)[] = [null, 'lisbon-resident-saldanha'];

/** SCR-058 Vehicles & permits. The active vehicle is mirrored into parking preferences on the server. */
export function VehiclesScreen({ navigation }: RootScreenProps<'Vehicles'>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['vehicles'], queryFn: vehiclesApi.list });
  const ent = useQuery({ queryKey: ['entitlement'], queryFn: billingApi.entitlement });
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [remove, setRemove] = useState<Vehicle | null>(null);
  const setParking = usePrefsStore(st => st.setParking);
  /** Searches read the vehicle/permit from the local prefs store, so mirror the server's active vehicle (M-07). */
  const applyVehicle = (v: Vehicle | null) => {
    if (v?.is_active) setParking({ vehicleClass: v.vehicle_class as VehicleClass, permitType: v.permit_type ?? null });
  };
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['vehicles'] }); void qc.invalidateQueries({ queryKey: ['preferences'] }); };
  const save = useMutation({ mutationFn: (v: Vehicle) => vehiclesApi.update(v.id, { label: v.label, vehicle_class: v.vehicle_class, permit_type: v.permit_type ?? null }),
    onSuccess: v => { applyVehicle(v); refresh(); setEdit(null); toast(t('vehicles.saved')); } });
  const del = useMutation({ mutationFn: (id: number) => vehiclesApi.remove(id), onSuccess: async () => {
    refresh(); setRemove(null);
    try { const p = await authApi.preferences(); setParking({ vehicleClass: p.vehicle_class, permitType: p.permit_type }); } catch { /* next prefs load syncs */ }
  } });
  const act = useMutation({ mutationFn: (id: number) => vehiclesApi.activate(id), onSuccess: v => { applyVehicle(v); refresh(); } });
  const items = q.data ?? [];
  const max = (ent.data?.limits as { vehicles?: number } | undefined)?.vehicles ?? 1;
  return (
    <Screen testID="vehicles-screen" header={<ScreenHeader title={t('vehicles.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <Body muted>{t('vehicles.intro')}</Body>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {items.map(v => edit?.id === v.id ? (
        <ZpotCard key={v.id} testID={`vehicle-edit-${v.id}`}>
          <ZpotTextField label={t('vehicles.name')} value={edit.label} onChangeText={label => setEdit({ ...edit, label })} maxLength={60} testID="vehicle-name" />
          <SectionLabel>{t('vehicles.type')}</SectionLabel>
          <Wrap>{CLASSES.map(c => <FilterChip key={c} label={t(`vehicles.${c}`)} selected={edit.vehicle_class === c} onPress={() => setEdit({ ...edit, vehicle_class: c })} testID={`vehicle-class-${c}`} />)}</Wrap>
          <SectionLabel>{t('vehicles.permit')}</SectionLabel>
          <Wrap>{PERMITS.map(p => <FilterChip key={p ?? 'none'} label={p ? t('vehicles.resident') : t('vehicles.noPermit')} selected={(edit.permit_type ?? null) === p}
            onPress={() => setEdit({ ...edit, permit_type: p })} testID={`vehicle-permit-${p ?? 'none'}`} />)}</Wrap>
          <ZpotButton label={t('vehicles.save')} disabled={!edit.label.trim()} loading={save.isPending} onPress={() => save.mutate(edit)} testID="vehicle-save" />
          {save.error ? <ErrorState error={save.error} /> : null}
        </ZpotCard>
      ) : (
        <ListRow key={v.id} icon="user" label={v.label} testID={`vehicle-${v.id}`}
          sub={`${t(`vehicles.${v.vehicle_class}`)} · ${v.permit_name ?? t('vehicles.noPermit')}`}
          value={v.is_active ? t('vehicles.active') : undefined} onPress={() => setEdit(v)}
          right={!v.is_active ? <ZpotButton variant="small" label={t('vehicles.activate')} onPress={() => act.mutate(v.id)} /> : null} />
      ))}
      {items.length > 1 ? null : items.length === 1 && items[0] && !edit ? (
        <ZpotButton variant="tertiary" icon="trash" label={t('vehicles.remove')} onPress={() => setRemove(items[0]!)} testID="vehicle-remove" />
      ) : null}
      {del.error || act.error ? <ErrorState error={del.error ?? act.error} testID="vehicles-error" /> : null}
      {items.length >= max ? <Banner tone="info" testID="vehicles-limit">{`${t('vehicles.freeLimit')} ${t('vehicles.proOnly')}`}</Banner> : null}
      <ConfirmDialog visible={!!remove} title={t('vehicles.removeQ', { name: remove?.label ?? '' })} confirmLabel={t('vehicles.remove')} destructive
        cancelLabel={t('common.cancel')} onCancel={() => setRemove(null)} onConfirm={() => remove && del.mutate(remove.id)} testID="vehicle-remove-dialog" />
    </Screen>
  );
}

/** SCR-059 Savings & history. Server totals; savings only from amounts the driver entered. */
export function InsightsScreen({ navigation }: RootScreenProps<'Insights'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['insights'], queryFn: insightsApi.get });
  const d = q.data;
  return (
    <Screen testID="insights-screen" header={<ScreenHeader title={t('insights.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {!d ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />) : d.sessions === 0 ? (
        <EmptyState icon="clock" title={t('insights.empty')} body={t('insights.emptySub')} testID="insights-empty" />
      ) : (
        <>
          <View style={styles.stats} testID="insights-stats">
            <Stat value={String(d.sessions)} label={t('insights.sessions')} />
            <Stat value={fmtDur(d.parked_minutes)} label={t('insights.parked')} />
            <Stat value={formatEuro(d.paid_total, i18n.language)} label={t('insights.paid')} />
          </View>
          <SectionLabel>{t('insights.savings')}</SectionLabel>
          {d.estimated_savings_total ? (
            <ZpotCard testID="insights-savings">
              <Text style={[typography.title, { color: palette.green700 }]}>{formatEuro(d.estimated_savings_total, i18n.language)}</Text>
              <Text style={[typography.meta, { color: colors.textMuted }]}>{t('insights.fromN', { n: d.estimated_savings_sessions })}</Text>
            </ZpotCard>
          ) : <Body muted>{t('insights.noSavings')}</Body>}
          <Text style={[typography.small, { color: colors.textSubtle }]}>{t('insights.savingsSub')}</Text>
        </>
      )}
      <ListRow icon="clock" label={t('insights.history')} onPress={() => navigation.navigate('SessionHistory')} testID="insights-history" />
      <ListRow icon="file" label={`🔒 ${t('insights.export')}`} sub={t('insights.exportPro')} onPress={() => navigation.navigate('Pro')} testID="insights-export" />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[typography.h2, { color: colors.text }]}>{value}</Text>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/** SCR-021 Partner offer. Disclosure-first; Zpot takes no payments and no booking link is configured. */
export function PartnerScreen({ navigation, route }: RootScreenProps<'Partner'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const plan = useSearchStore(s => s.plan);
  const q = useAreaDetail(route.params.areaId, { duration_minutes: plan.durationHours * 60 });
  const a = q.data;
  return (
    <Screen testID="partner-screen" header={<ScreenHeader title={t('partner.title')} onBack={navigation.goBack} close backLabel={t('common.close')} />}
      footer={<>
        <ZpotButton label={t('partner.cta')} disabled testID="partner-cta" />
        <ZpotButton variant="tertiary" label={t('partner.notNow')} onPress={navigation.goBack} testID="partner-not-now" />
      </>}>
      {!a ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />) : (
        <>
          <Text style={[typography.label, { color: colors.textMuted }]}>{t('partner.badge')}</Text>
          <Title size="h2">{a.name}</Title>
          {a.commercial?.offer ? <Body>{a.commercial.offer}</Body> : null}
          <SummaryRow k={t('partner.stay')} v={fmtDur(plan.durationHours * 60)} />
          <SummaryRow k={t('partner.price')} v={a.expected_total_cost != null ? formatEuro(a.expected_total_cost, i18n.language) : t('card.costUnknown')} />
          <SummaryRow k={t('partner.reservation')} v={t('partner.guaranteed')} />
          {a.commercial?.ev_charging ? <SummaryRow k={t('partner.ev')} v={a.commercial.ev_charging} /> : null}
          <Banner tone="info">{t('partner.freeFirst')}</Banner>
          <Body muted>{t('partner.noPay')}</Body>
          <Text style={[typography.meta, { color: colors.textMuted }]} testID="partner-not-connected">{t('partner.ctaNote')}</Text>
        </>
      )}
    </Screen>
  );
}

/** SCR-055 Your subscription — real entitlement state from the server (Free; no billing provider in this build). */
export function ManageSubscriptionScreen({ navigation }: RootScreenProps<'ManageSubscription'>) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['entitlement'], queryFn: billingApi.entitlement });
  const [restored, setRestored] = useState(false);
  const e = q.data;
  return (
    <Screen testID="manage-sub-screen" header={<ScreenHeader title={t('sub.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {!e ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />) : (
        <>
          <SummaryRow k={t('sub.plan')} v={t('sub.free')} />
          <SummaryRow k={t('sub.status')} v={t('sub.none')} />
          <SummaryRow k={t('sub.billing')} v={t('sub.noBilling')} />
          <Body>{t('sub.keep')}</Body>
          <ZpotButton variant="secondary" label={t('sub.restore')} onPress={() => setRestored(true)} testID="sub-restore" />
          {restored ? <Banner tone="info" testID="sub-restore-none">{t('sub.restoreNone')}</Banner> : null}
          <ListRow icon="star" label={t('p2.pro')} onPress={() => navigation.navigate('Pro')} testID="sub-pro" />
          <Body muted>{t('sub.note')}</Body>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  col: { gap: 10 },
  flex: { flex: 1 },
  day: { borderTopWidth: 1, paddingTop: 8, marginTop: 8, gap: 4 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.lg },
});
