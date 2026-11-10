import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  Banner, ConfirmDialog, EmptyState, errorMessage, ErrorState, FilterChip, ListRow, LoadingState, Screen, ScreenHeader, SectionLabel,
  Stepper, SummaryRow, Title, Toggle, Wrap, ZpotButton, ZpotCard, ZpotTextField,
} from '../../components/common';
import { toast } from '../../components/common/Toast';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { fmtDur, requestNotifPermission } from '../../features/shared';
import { qk } from '../../hooks/useAccount';
import { usePaged } from '../../hooks/usePaged';
import { useAreaDetail } from '../../hooks/useParking';
import type { RootScreenProps } from '../../navigation/types';
import { sessionsApi } from '../../services/api';
import { ApiError } from '../../services/api/errors';
import { usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, typography, useTheme } from '../../theme';
import type { Session, SessionWarning } from '../../types/contracts';
import { formatEuro } from '../../utils/format';
import { formatDate, formatTime } from '../../utils/time';

const REMINDER_CHOICES = [0, 10, 15, 30];
type AreaRef = { id: number; name: string; verification_status?: string };
const areaOf = (s: { area: unknown }) => s.area as AreaRef;

function minutesFrom(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function ReminderPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionLabel>{t('session.remindMe')}</SectionLabel>
      <Wrap>
        {REMINDER_CHOICES.map(n => (
          <FilterChip key={n} label={n ? t('session.minBefore', { n }) : t('session.noReminder')} selected={value === n}
            onPress={() => onChange(n)} testID={`reminder-${n}`} />
        ))}
      </Wrap>
    </>
  );
}

function WarningList({ warnings }: { warnings: SessionWarning[] }) {
  const { t } = useTranslation();
  if (!warnings.length) return null;
  return (
    <View style={styles.gap} testID="session-warnings">
      <SectionLabel>{t('session.warnings')}</SectionLabel>
      {warnings.map(w => <Banner key={w.code} tone={w.code === 'planned_end_after_deadline' ? 'error' : 'warn'}>{w.message}</Banner>)}
    </View>
  );
}

/** SCR: Start parking session. Rules are evaluated by the server; the app only shows the result. */
export function StartSessionScreen({ navigation, route }: RootScreenProps<'StartSession'>) {
  const { areaId } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const plan = useSearchStore(s => s.plan);
  const notifPermission = usePrefsStore(s => s.notifPermission);
  const [initialMinutes] = useState(Math.max(30, Math.round(plan.durationHours * 60)));
  const [minutes, setMinutes] = useState(initialMinutes);
  const [reminder, setReminder] = useState(15);
  const [prime, setPrime] = useState<string | null>(null);
  // Keyed to the initial stay so adjusting the plan never blanks the screen; the server re-evaluates on start.
  const area = useAreaDetail(areaId, { duration_minutes: initialMinutes });
  const start = useMutation({
    mutationFn: () => sessionsApi.start({ area_id: areaId, duration_minutes: minutes, reminder_minutes: reminder }),
    onSuccess: res => {
      void qc.invalidateQueries({ queryKey: qk.activeSession });
      void qc.invalidateQueries({ queryKey: qk.sessions });
      if (reminder && notifPermission === 'unknown') setPrime(res.session.id);
      else navigation.replace('Session', { id: res.session.id });
    },
  });
  const err = start.error instanceof ApiError ? start.error : null;
  const end = new Date(Date.now() + minutes * 60000);
  const a = area.data;
  const deadline = a?.leave_by ? new Date(a.leave_by) : null;
  const over = deadline && deadline < end;

  return (
    <Screen testID="start-session-screen" header={<ScreenHeader title={t('session.startTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton label={start.isPending ? t('session.starting') : t('session.start')} loading={start.isPending}
        disabled={!a || a.category === 'restricted'} onPress={() => start.mutate()} testID="start-session-submit" />}>
      {!a ? (area.isLoading ? <LoadingState skeleton={2} /> : <ErrorState error={area.error} onRetry={() => void area.refetch()} />) : (
        <>
          <ZpotCard>
            <Text style={[typography.label, { color: colors.textMuted }]}>{t('session.parkedAt')}</Text>
            <Text style={[typography.h2, { color: colors.text }]} testID="start-session-area">{a.name}</Text>
            <ParkingStatusBadge category={a.category} label={t(`category.${a.category}`)} />
            <Text style={[typography.meta, { color: colors.textMuted }]}>{t('session.startedNow')}</Text>
          </ZpotCard>
          {a.category === 'restricted' ? <Banner tone="error" testID="start-session-blocked">{a.blocking_reason?.label ?? t('details.cantPark')}</Banner> : null}
          {a.category === 'unknown' ? <Banner tone="warn">{t('session.unconfirmedRule')}</Banner> : null}
          <SectionLabel>{t('session.plannedDeparture')}</SectionLabel>
          <Stepper value={`${formatTime(end)} · ${fmtDur(minutes)}`} testID="start-session-duration"
            onMinus={() => setMinutes(m => Math.max(15, m - 15))} onPlus={() => setMinutes(m => Math.min(24 * 60, m + 15))}
            minusLabel={t('p3.minus', { n: 15 })} plusLabel={t('p3.plus', { n: 15 })} />
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t('session.yourPlan', { dur: fmtDur(minutes) })}</Text>
          <View style={[styles.deadline, { borderColor: over ? palette.red500 : colors.border }]} testID="start-session-deadline">
            <Text style={[typography.label, { color: colors.textMuted }]}>{t('session.deadlineTitle')}</Text>
            {deadline ? (
              <>
                <Text style={[typography.h2, { color: colors.text }]}>{t('session.moveBy', { time: formatTime(deadline) })}</Text>
                {a.leave_by_reason ? <Text style={[typography.meta, { color: colors.textBody }]}>{t('session.because', { reason: a.leave_by_reason.label })}</Text> : null}
              </>
            ) : <Text style={[typography.body, { color: colors.textBody }]}>{t('session.noDeadline')}</Text>}
            {over ? <Banner tone="error">{t('session.overDeadline')}</Banner> : null}
          </View>
          <ReminderPicker value={reminder} onChange={setReminder} />
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t('session.remindNote')}</Text>
          {err?.code === 'active_session_exists' ? (
            <Banner tone="warn" testID="start-session-already" action={{ label: t('notif.open'), onPress: async () => {
              try { const s = await sessionsApi.active(); if (s) navigation.replace('Session', { id: s.id }); }
              catch (e) { toast(errorMessage(e, t)); }
            } }}>{t('session.alreadyActive')}</Banner>
          ) : start.error ? <ErrorState error={start.error} testID="start-session-error" /> : null}
          <Text style={[typography.small, { color: colors.textSubtle }]}>{formatDate(new Date().toISOString(), i18n.language)}</Text>
        </>
      )}
      <ConfirmDialog visible={!!prime} title={t('session.notifPrimeTitle')} body={t('session.notifPrimeBody')}
        confirmLabel={t('session.allow')} cancelLabel={t('session.notNow')} testID="notif-prime"
        onConfirm={async () => { const id = prime!; setPrime(null); await requestNotifPermission(); navigation.replace('Session', { id }); }}
        onCancel={() => { usePrefsStore.getState().setNotifPermission('denied'); const id = prime!; setPrime(null); navigation.replace('Session', { id }); }} />
    </Screen>
  );
}

function useSession(id: string) {
  // Poll only while the session is active (time left / rule changes); finished sessions don't change.
  return useQuery({ queryKey: qk.session(id), queryFn: () => sessionsApi.get(id),
    refetchInterval: q => (q.state.data?.status === 'active' ? 30_000 : false) });
}

function ruleLabel(s: Session, t: TFunction, lang: string) {
  const v = areaOf(s).verification_status;
  if (v === 'verified') return t('session.verifiedRule', { date: formatDate(s.evaluated_at, lang) });
  if (v === 'community_confirmed') return t('session.communityRule');
  return t('session.unconfirmedRule');
}

/** SCR: Active session / session details. */
export function SessionScreen({ navigation, route }: RootScreenProps<'Session'>) {
  const { id } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const q = useSession(id);
  const s = q.data;
  if (!s) {
    return (
      <Screen testID="session-screen" header={<ScreenHeader onBack={navigation.goBack} backLabel={t('common.back')} />}>
        {q.isLoading ? <LoadingState skeleton={3} /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Screen>
    );
  }
  const area = areaOf(s);
  const active = s.status === 'active';
  const left = s.remaining_minutes;
  const over = s.restriction_deadline && new Date(s.restriction_deadline) < new Date(s.planned_end_at);
  const ruleChanged = s.events.some(e => (e as { kind?: string }).kind === 'rules_changed');
  const sent = s.reminders.filter(r => r.status === 'sent').length;

  return (
    <Screen testID="session-screen" header={<ScreenHeader title={active ? t('session.activeTitle') : area.name} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={active ? (
        <View style={styles.row}>
          <ZpotButton style={styles.flex} variant="secondary" label={t('session.edit')} onPress={() => navigation.navigate('EditSession', { id })} testID="session-edit" />
          <ZpotButton style={styles.flex} label={t('session.end')} onPress={() => navigation.navigate('EndSession', { id })} testID="session-end" />
        </View>
      ) : <ZpotButton variant="secondary" label={t('session.summaryTitle')} onPress={() => navigation.navigate('SessionSummary', { id })} testID="session-summary" />}>
      {active ? (
        <View style={[styles.timer, { backgroundColor: s.is_overdue ? palette.red50 : palette.green50 }]} testID="session-timer">
          <Text style={[typography.label, { color: colors.textMuted }]}>{s.is_overdue ? t('session.timeUp') : t('session.timeLeft')}</Text>
          <Text style={[typography.title, { color: s.is_overdue ? palette.red600 : palette.green700 }]} accessibilityLiveRegion="polite">
            {left != null ? fmtDur(Math.abs(left)) : '—'}
          </Text>
          <Text style={[typography.meta, { color: colors.textBody }]}>{t('session.planToLeave', { time: formatTime(s.planned_end_at) })}</Text>
        </View>
      ) : <Banner tone="info">{t(s.status === 'expired' ? 'session.expired' : 'session.ended')}</Banner>}
      <Title size="h2">{area.name}</Title>
      {over ? <Banner tone="error" testID="session-over-deadline">{t('session.overDeadline')}</Banner> : null}
      {ruleChanged ? <Banner tone="warn" testID="session-rule-changed">{t('session.ruleChanged')}</Banner> : null}
      <SummaryRow k={t('session.started')} v={formatTime(s.started_at)} />
      <SummaryRow k={t('session.plannedYour')} v={formatTime(s.planned_end_at)} />
      <SummaryRow k={t('session.deadlineLegal')} v={s.restriction_deadline ? formatTime(s.restriction_deadline) : t('session.noDeadline')} />
      {s.restriction_reason ? <Text style={[typography.meta, { color: colors.textMuted }]}>{t('session.because', { reason: s.restriction_reason })}</Text> : null}
      <SummaryRow k={t('session.costEstimate')} v={s.expected_cost != null ? formatEuro(s.expected_cost, i18n.language) : t('card.costUnknown')} />
      <SummaryRow k={t('session.reminder')} v={s.reminder_minutes ? `${t('session.minBefore', { n: s.reminder_minutes })} · ${t('session.inAppOnly')}${sent ? ' ✓' : ''}` : t('session.noReminder')} />
      <SummaryRow k={t('details.verification')} v={ruleLabel(s, t, i18n.language)} />
      {active ? (
        <ZpotButton variant="small" icon="flag" label={t('session.report')} testID="session-report"
          onPress={() => navigation.navigate('ReportType', { areaId: area.id, sessionId: s.id })} />
      ) : null}
      <Text style={[typography.meta, { color: colors.textMuted }]}>{t('session.remindNote')}</Text>
    </Screen>
  );
}

/** SCR: Edit planned departure. The server re-checks rules and returns warnings. */
export function EditSessionScreen({ navigation, route }: RootScreenProps<'EditSession'>) {
  const { id } = route.params;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useSession(id);
  const [delta, setDelta] = useState(0);
  const [reminder, setReminder] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<SessionWarning[]>([]);
  const save = useMutation({
    mutationFn: (s: Session) => sessionsApi.update(id, {
      planned_end_at: new Date(new Date(s.planned_end_at).getTime() + delta * 60000).toISOString(),
      reminder_minutes: reminder ?? s.reminder_minutes,
    }),
    onSuccess: res => {
      qc.setQueryData(qk.session(id), res.session);
      void qc.invalidateQueries({ queryKey: qk.activeSession });
      void qc.invalidateQueries({ queryKey: qk.sessions });
      setWarnings(res.warnings);
      toast(t('session.updated'));
      if (!res.warnings.length) navigation.goBack();
    },
  });
  const s = q.data;
  if (!s) return <Screen header={<ScreenHeader onBack={navigation.goBack} />}><LoadingState /></Screen>;
  const newEnd = new Date(new Date(s.planned_end_at).getTime() + delta * 60000);
  const over = !!s.restriction_deadline && newEnd > new Date(s.restriction_deadline);
  const total = minutesFrom(s.started_at, newEnd);
  return (
    <Screen testID="edit-session-screen" header={<ScreenHeader title={t('session.editTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={warnings.length ? <ZpotButton label={t('common.done')} onPress={navigation.goBack} testID="edit-session-done" />
        : <ZpotButton variant={over ? 'danger' : 'primary'} label={over ? t('session.saveAnyway') : t('session.savePlan')} loading={save.isPending}
          onPress={() => save.mutate(s)} testID="edit-session-save" />}>
      <SectionLabel>{t('session.plannedDeparture')}</SectionLabel>
      <Stepper value={`${formatTime(newEnd)} · ${fmtDur(total)}`} testID="edit-session-duration"
        onMinus={() => setDelta(d => (total - 15 >= 15 ? d - 15 : d))} onPlus={() => setDelta(d => d + 15)} minusLabel={t('p3.minus', { n: 15 })} plusLabel={t('p3.plus', { n: 15 })} />
      <SummaryRow k={t('session.deadlineLegal')} v={s.restriction_deadline ? formatTime(s.restriction_deadline) : t('session.noDeadline')} />
      {over ? <Banner tone="error" testID="edit-session-over">{t('session.overDeadline')}</Banner> : null}
      <ReminderPicker value={reminder ?? s.reminder_minutes ?? 0} onChange={setReminder} />
      <WarningList warnings={warnings} />
      {save.error ? <ErrorState error={save.error} /> : null}
    </Screen>
  );
}

const COST_RE = /^\d{1,4}([.,]\d{1,2})?$/;

/** SCR: End session (optional outcome, cost and departure share). */
export function EndSessionScreen({ navigation, route }: RootScreenProps<'EndSession'>) {
  const { id } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const q = useSession(id);
  const [share, setShare] = useState(true);
  const [outcome, setOutcome] = useState('');
  const [cost, setCost] = useState('');
  const costErr = cost && !COST_RE.test(cost.trim()) ? t('session.costErr') : undefined;
  const end = useMutation({
    mutationFn: () => sessionsApi.end(id, { share_departure: share, outcome: outcome || undefined,
      cost_paid: cost.trim() ? cost.trim().replace(',', '.') : null }),
    onSuccess: res => {
      void qc.invalidateQueries({ queryKey: qk.activeSession });
      void qc.invalidateQueries({ queryKey: qk.sessions });
      void qc.invalidateQueries({ queryKey: qk.myReports });
      void qc.invalidateQueries({ queryKey: qk.contributions });
      void qc.invalidateQueries({ queryKey: ['insights'] });
      qc.setQueryData(qk.session(id), res.session);
      navigation.replace('SessionSummary', { id, reportRef: res.session.shared_departure ? 'shared' : undefined });
    },
  });
  const s = q.data;
  return (
    <Screen testID="end-session-screen" header={<ScreenHeader title={t('session.endTitle')} onBack={navigation.goBack} close backLabel={t('common.close')} />}
      footer={<>
        <ZpotButton label={t('session.end')} loading={end.isPending} disabled={!!costErr || !s} onPress={() => end.mutate()} testID="end-session-confirm" />
        <ZpotButton variant="tertiary" label={t('session.keepParking')} onPress={navigation.goBack} testID="end-session-keep" />
      </>}>
      {s ? <Text style={[typography.h2, { color: colors.text }]}>{t('session.parkedFor', { dur: fmtDur(minutesFrom(s.started_at, new Date())) })}</Text> : <LoadingState />}
      <Toggle value={share} onValueChange={setShare} label={t('session.leavingSpot')} sub={t('session.leavingSub')} testID="end-session-share" />
      <SectionLabel>{t('session.howWasIt')}</SectionLabel>
      <Wrap>
        {(['easy', 'ok', 'hard'] as const).map(o => (
          <FilterChip key={o} label={t(`session.${o}`)} selected={outcome === o} onPress={() => setOutcome(v => (v === o ? '' : o))} testID={`end-outcome-${o}`} />
        ))}
      </Wrap>
      <ZpotTextField label={t('session.whatPaid')} value={cost} onChangeText={setCost} keyboardType="decimal-pad" error={costErr}
        hint={t('session.paidNote')} testID="end-session-cost" />
      {end.error ? <ErrorState error={end.error} testID="end-session-error" /> : null}
    </Screen>
  );
}

/** SCR: Session summary with an honest saving estimate (only when the driver entered what they paid). */
export function SessionSummaryScreen({ navigation, route }: RootScreenProps<'SessionSummary'>) {
  const { id, reportRef } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['session-summary', id], queryFn: () => sessionsApi.summary(id) });
  const done = () => navigation.navigate('Main', { screen: 'Explore' });
  const s = q.data;
  const saving = s?.estimated_saving as null | { amount: string; compared_with: string; rate_per_hour: string; hours: number };
  return (
    <Screen testID="session-summary-screen" header={<ScreenHeader title={t('session.summaryTitle')} onBack={done} close backLabel={t('common.close')} />}
      footer={<ZpotButton label={t('report.done')} onPress={done} testID="session-summary-done" />}>
      {!s ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />) : (
        <>
          <View style={[styles.okIcon, { backgroundColor: palette.green50 }]}><Text style={styles.okText}>✓</Text></View>
          <SummaryRow k={t('session.location')} v={(s.area as AreaRef).name} />
          <SummaryRow k={t('session.duration')} v={fmtDur(s.duration_minutes)} />
          <SummaryRow k={t('session.parkingRule')} v={t(`details.confidence_${s.verification_status}`, { defaultValue: s.verification_status })} />
          <SummaryRow k={t('session.costEstimate')} v={s.expected_cost != null ? formatEuro(s.expected_cost, i18n.language) : t('card.costUnknown')} />
          <SummaryRow k={t('session.youPaid')} v={s.cost_paid != null ? formatEuro(s.cost_paid, i18n.language) : t('session.notEntered')} />
          {saving ? (
            <Banner tone="ok" testID="session-saving">{t('session.saving', { amount: formatEuro(saving.amount, i18n.language),
              rate: formatEuro(saving.rate_per_hour, i18n.language), place: saving.compared_with, hours: saving.hours })}</Banner>
          ) : <Text style={[typography.meta, { color: colors.textMuted }]} testID="session-no-saving">{t('session.noSaving')}</Text>}
          {s.shared_departure || reportRef ? (
            <Banner tone="info" testID="session-shared" action={{ label: t('session.viewReport'), onPress: () => navigation.navigate('MyReports') }}>
              {t('session.shared')}
            </Banner>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** SCR: Parking history. */
export function SessionHistoryScreen({ navigation }: RootScreenProps<'SessionHistory'>) {
  const { t, i18n } = useTranslation();
  const q = usePaged(qk.sessions, () => sessionsApi.list());
  const items = q.items;
  return (
    <Screen testID="session-history-screen" header={<ScreenHeader title={t('session.historyTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {q.isLoading ? <LoadingState skeleton={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : items.length === 0 ? <EmptyState icon="clock" title={t('session.historyTitle')} body={t('session.historyEmpty')} /> : null}
      {items.map(s => (
        <ListRow key={s.id} icon={s.status === 'active' ? 'clock' : 'check'} label={areaOf(s).name} testID={`history-${s.id}`}
          sub={`${formatDate(s.started_at, i18n.language)} · ${formatTime(s.started_at)}–${formatTime(s.ended_at ?? s.planned_end_at)}`}
          value={t(`session.${s.status === 'active' ? 'active' : s.status === 'expired' ? 'expired' : 'ended'}`)}
          onPress={() => navigation.navigate('Session', { id: s.id })} />
      ))}
      {q.hasNextPage ? <ZpotButton variant="small" label={t('common.loadMore')} loading={q.isFetchingNextPage}
        onPress={() => void q.fetchNextPage()} testID="history-load-more" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 8 },
  row: { flexDirection: 'row', gap: 10 },
  deadline: { borderWidth: 1.5, borderRadius: radius.xl, padding: 14, gap: 6 },
  timer: { borderRadius: radius.xl, padding: 16, gap: 4, alignItems: 'flex-start' },
  okIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  okText: { fontSize: 30, color: palette.green700, fontWeight: '800' },
});
