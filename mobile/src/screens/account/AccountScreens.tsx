import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Banner, Body, BottomSheet, ConfirmDialog, EmptyState, errorMessage, ErrorState, ListRow, LoadingState, Row, Screen, ScreenHeader, SectionLabel,
  SummaryRow, Title, Toggle, ZpotButton, ZpotCard, ZpotTextField,
} from '../../components/common';
import { toast } from '../../components/common/Toast';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { fmtDur, requestNotifPermission, syncNotifPermission } from '../../features/shared';
import { usePaged } from '../../hooks/usePaged';
import { qk, useActiveSession, useAuthed, useContributions, useFeatures, useHasRole, useNotifications } from '../../hooks/useAccount';
import type { RootScreenProps } from '../../navigation/types';
import { notificationsApi, savedApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, typography, useTheme } from '../../theme';
import type { AppNotification, NotificationPrefs, SavedLocation } from '../../types/contracts';
import { formatDate, formatTime } from '../../utils/time';

function TabPage({ title, children, testID, right, onRefresh }: {
  title: string; children: React.ReactNode; testID: string; right?: React.ReactNode; onRefresh?: () => Promise<unknown>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const pull = async () => { setRefreshing(true); try { await onRefresh?.(); } finally { setRefreshing(false); } };
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]} testID={testID}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={() => void pull()} tintColor={palette.green700}
        colors={[palette.green700]} testID={`${testID}-refresh`} /> : undefined}>
      <Row><View style={styles.flex}><Title size="h1">{title}</Title></View>{right}</Row>
      {children}
    </ScrollView>
  );
}

type Area = { id: number; name: string };
type Current = { category: string; rules_changed: boolean; blocking_reason: { label: string } | null };

/** Item shown on the Saved tab: server-synced for accounts, device-only for guests. */
interface SavedItem { key: string; id?: number; areaId: number; label: string; category: string; changed?: string | null }

function toItem(s: SavedLocation): SavedItem {
  const cur = s.current as Current;
  return { key: `s${s.id}`, id: s.id, areaId: (s.area as Area).id, label: s.label || (s.area as Area).name, category: cur.category,
    changed: cur.rules_changed ? (cur.blocking_reason?.label ?? '') : null };
}

/** TAB: Saved — locations, destinations, recent searches. */
export function SavedScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const authed = useAuthed();
  const { guestSaved, removeGuestSaved, renameGuestSaved, recents, clearRecents } = usePrefsStore();
  const setDestination = useSearchStore(s => s.setDestination);
  const locs = useQuery({ queryKey: qk.saved, queryFn: savedApi.locations, enabled: authed });
  const dests = useQuery({ queryKey: qk.destinations, queryFn: savedApi.destinations, enabled: authed });
  const recent = useQuery({ queryKey: qk.recent, queryFn: savedApi.recent, enabled: authed });
  const [rename, setRename] = useState<SavedItem | null>(null);
  const [name, setName] = useState('');
  const [remove, setRemove] = useState<SavedItem | null>(null);
  const items: SavedItem[] = authed ? (locs.data ?? []).map(toItem)
    : guestSaved.map(g => ({ key: `g${g.areaId}`, areaId: g.areaId, label: g.label, category: g.category }));
  const refresh = () => { void qc.invalidateQueries({ queryKey: qk.saved }); };
  /** Server actions never throw into the UI: failures keep the item and explain why. */
  const safely = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { toast(errorMessage(e, t)); } };
  const doRename = () => safely(async () => {
    if (!rename || !name.trim()) return;
    if (rename.id) { await savedApi.rename(rename.id, name.trim()); refresh(); } else renameGuestSaved(rename.areaId, name.trim());
    setRename(null);
  });
  const doRemove = () => safely(async () => {
    if (!remove) return;
    const item = remove;
    setRemove(null);
    if (item.id) { await savedApi.remove(item.id); refresh(); }
    removeGuestSaved(item.areaId);
    toast(t('saved.removed'));
  });
  const recentRows = authed ? (recent.data ?? []).map(r => ({ id: String(r.id), name: r.name, subtitle: r.subtitle ?? '',
    ...(r.location as { latitude: number; longitude: number }) })) : recents;
  return (
    <TabPage title={t('saved.title')} testID="saved-screen"
      onRefresh={authed ? () => Promise.all([locs.refetch(), dests.refetch(), recent.refetch()]) : undefined}>
      {!authed ? <Banner tone="info" action={{ label: t('p2.signIn'), onPress: () => navigation.navigate('SignIn', { context: 'saved' }) }}>{t('saved.guestNote')}</Banner> : null}
      <SectionLabel>{t('saved.locations')}</SectionLabel>
      {authed && locs.isLoading ? <LoadingState skeleton={2} /> : authed && locs.isError ? <ErrorState error={locs.error} onRetry={() => void locs.refetch()} />
        : items.length === 0 ? <EmptyState icon="bookmark" title={t('saved.locations')} body={t('saved.empty')} testID="saved-empty" /> : null}
      {items.map(it => (
        <ZpotCard key={it.key} testID={`saved-${it.areaId}`}>
          <ParkingStatusBadge category={it.category as never} label={t(`category.${it.category}`)} />
          <View style={styles.mt}><Title size="h2">{it.label}</Title></View>
          {it.changed != null ? <Banner tone="warn" testID={`saved-changed-${it.areaId}`}>{t('saved.changed', { reason: it.changed })}</Banner> : null}
          <Row style={styles.wrap} gap={8}>
            <ZpotButton variant="small" label={t('saved.checkNow')} onPress={() => navigation.navigate('ParkingDetails', { id: it.areaId })} testID={`saved-check-${it.areaId}`} />
            <ZpotButton variant="small" label={t('saved.rename')} onPress={() => { setName(it.label); setRename(it); }} testID={`saved-rename-${it.areaId}`} />
            <ZpotButton variant="small" icon="trash" label={t('saved.remove')} onPress={() => setRemove(it)} testID={`saved-remove-${it.areaId}`} />
          </Row>
        </ZpotCard>
      ))}
      {authed ? (
        <>
          <SectionLabel>{t('saved.destinations')}</SectionLabel>
          {(dests.data ?? []).length === 0 ? <Text style={[typography.meta, styles.muted]}>—</Text> : null}
          {(dests.data ?? []).map(d => {
            const loc = d.location as { latitude: number; longitude: number };
            return (
              <ListRow key={d.id} icon="star" label={d.label || d.name} sub={d.subtitle} testID={`dest-${d.id}`}
                onPress={() => { setDestination({ id: d.place_ref || `dest-${d.id}`, name: d.name, subtitle: d.subtitle ?? '', ...loc }); navigation.navigate('Main', { screen: 'Explore' }); }}
                right={<ZpotButton variant="tertiary" label={t('saved.remove')} testID={`dest-remove-${d.id}`}
                  onPress={() => void safely(async () => { await savedApi.removeDestination(d.id); void qc.invalidateQueries({ queryKey: qk.destinations }); toast(t('saved.removed')); })} />} />
            );
          })}
        </>
      ) : null}
      <Row><View style={styles.flex}><SectionLabel>{t('saved.recent')}</SectionLabel></View>
        {recentRows.length ? <ZpotButton variant="tertiary" label={t('saved.clearRecent')} testID="recent-clear"
          onPress={() => void safely(async () => { if (authed) { await savedApi.clearRecent(); void qc.invalidateQueries({ queryKey: qk.recent }); } clearRecents(); })} /> : null}
      </Row>
      {recentRows.map(r => (
        <ListRow key={r.id} icon="clock" label={r.name} sub={r.subtitle} testID={`saved-recent-${r.id}`}
          onPress={() => { setDestination(r); navigation.navigate('Main', { screen: 'Explore' }); }} />
      ))}
      <BottomSheet visible={!!rename} onClose={() => setRename(null)} title={t('saved.renameTitle')} testID="rename-sheet" closeLabel={t('common.close')}>
        <ZpotTextField label={t('saved.nameLabel')} value={name} onChangeText={setName} maxLength={80} error={name.trim() ? undefined : t('saved.nameErr')} testID="rename-input" />
        <ZpotButton label={t('common.save')} disabled={!name.trim()} onPress={() => void doRename()} testID="rename-save" />
      </BottomSheet>
      <ConfirmDialog visible={!!remove} title={t('saved.removeQ', { name: remove?.label ?? '' })} destructive
        body={t('saved.removeBody', { sync: authed ? t('saved.andAccount') : '' })} confirmLabel={t('saved.remove')}
        cancelLabel={t('common.cancel')} onCancel={() => setRemove(null)} onConfirm={() => void doRemove()} testID="remove-dialog" />
    </TabPage>
  );
}

/** Save button behaviour from parking details: account → server; guest → choose device-only or create account. */
export function useSaveLocation() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const authed = useAuthed();
  const navigation = useNavigation();
  const [guestSheet, setGuestSheet] = useState<{ areaId: number; name: string; category: string } | null>(null);
  const save = async (a: { id: number; name: string; category: string }) => {
    if (!authed) { setGuestSheet({ areaId: a.id, name: a.name, category: a.category }); return; }
    try {
      await savedApi.save(a.id, a.name);
      void qc.invalidateQueries({ queryKey: qk.saved });
      toast(t('saved.savedToast'));
    } catch (e) { toast(errorMessage(e, t)); }
  };
  const keepOnDevice = (thenRegister: boolean) => {
    if (!guestSheet) return;
    usePrefsStore.getState().addGuestSaved({ areaId: guestSheet.areaId, label: guestSheet.name, savedAt: new Date().toISOString(), category: guestSheet.category });
    const id = guestSheet.areaId;
    setGuestSheet(null);
    if (thenRegister) {
      useAuthStore.getState().setPendingReturn({ route: 'ParkingDetails', params: { id } });
      navigation.navigate('Register', { context: 'save' });
    } else toast(t('saved.savedDevice'));
  };
  const sheet = (
    <BottomSheet visible={!!guestSheet} onClose={() => setGuestSheet(null)} title={t('saved.saveGuestTitle')} testID="save-guest-sheet" closeLabel={t('common.close')}>
      <Body style={styles.body}>{t('saved.saveGuestBody')}</Body>
      <ZpotButton label={t('saved.createAndSave')} onPress={() => keepOnDevice(true)} testID="save-guest-register" />
      <ZpotButton variant="secondary" label={t('saved.saveDevice')} onPress={() => keepOnDevice(false)} testID="save-guest-device" />
    </BottomSheet>
  );
  return { save, sheet };
}

/** TAB: Activity — active session, history, reports, contributions. */
export function ActivityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const authed = useAuthed();
  const active = useActiveSession();
  const contrib = useContributions();
  const notifs = useNotifications();
  const unread = notifs.data?.unread_count ?? 0;
  const s = active.data;
  return (
    <TabPage title={t('activity2.title')} testID="activity-screen"
      onRefresh={authed ? () => Promise.all([active.refetch(), contrib.refetch(), notifs.refetch()]) : undefined}
      right={authed ? <ZpotButton variant="small" icon="bell" label={unread ? String(unread) : t('notif.title')} testID="activity-bell"
        onPress={() => navigation.navigate('Notifications')} /> : null}>
      {!authed ? (
        <>
          <Banner tone="info" action={{ label: t('p2.signIn'), onPress: () => navigation.navigate('SignIn', { context: 'activity' }) }}>{t('activity2.signIn')}</Banner>
          <ListRow icon="flag" label={t('activity2.myReports')} onPress={() => navigation.navigate('MyReports')} testID="activity-reports" />
        </>
      ) : (
        <>
          {active.isLoading ? <LoadingState /> : s ? (
            <ZpotCard testID="activity-active-session" onPress={() => navigation.navigate('Session', { id: s.id })}>
              <Text style={[typography.label, { color: colors.textMuted }]}>{t('session.activeTitle')}</Text>
              <Text style={[typography.h2, { color: colors.text }]}>{(s.area as Area).name}</Text>
              <Text style={[typography.body, { color: s.is_overdue ? palette.red600 : colors.textBody }]}>
                {s.is_overdue ? t('session.timeUp') : `${t('session.timeLeft')}: ${fmtDur(s.remaining_minutes ?? 0)}`}
              </Text>
              <Text style={[typography.meta, { color: colors.textMuted }]}>{t('session.tapToOpen')}</Text>
            </ZpotCard>
          ) : <EmptyState icon="clock" title={t('activity2.noActive')} body={t('activity2.noActiveSub')} testID="activity-no-session" />}
          {contrib.data ? (
            <View style={styles.stats} testID="activity-stats">
              <Stat n={contrib.data.reports} label={t('activity2.reports')} />
              <Stat n={contrib.data.verifications} label={t('activity2.verifications')} />
              <Stat n={contrib.data.accepted} label={t('activity2.accepted')} />
            </View>
          ) : null}
          <ListRow icon="clock" label={t('activity2.history')} onPress={() => navigation.navigate('SessionHistory')} testID="activity-history" />
          <ListRow icon="flag" label={t('activity2.myReports')} onPress={() => navigation.navigate('MyReports')} testID="activity-reports" />
          <ListRow icon="star" label={t('activity2.contributions')} onPress={() => navigation.navigate('Contributions')} testID="activity-contrib" />
          <ListRow icon="bell" label={t('notif.title')} value={unread ? String(unread) : undefined} onPress={() => navigation.navigate('Notifications')} testID="activity-notifs" />
        </>
      )}
    </TabPage>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]} accessible accessibilityLabel={`${n} ${label}`}>
      <Text style={[typography.h1, { color: colors.text }]}>{n}</Text>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/** SCR: Your contributions (trust is explainable and never overrides verified rules). */
export function ContributionsScreen({ navigation }: RootScreenProps<'Contributions'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const q = useContributions();
  const d = q.data;
  return (
    <Screen testID="contributions-screen" onRefresh={q.refetch} header={<ScreenHeader title={t('activity2.contributions')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {!d ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />) : (
        <>
          <Title size="h2">{t(`activity2.level_${d.level}`)}</Title>
          <SummaryRow k={t('activity2.karma')} v={`${Math.round(d.karma * 100)} / 100`} />
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t('activity2.karmaNote')}</Text>
          <View style={styles.stats}>
            <Stat n={d.reports} label={t('activity2.reports')} />
            <Stat n={d.verifications} label={t('activity2.verifications')} />
            <Stat n={d.accepted} label={t('activity2.accepted')} />
          </View>
          <SectionLabel>{t('activity2.recent')}</SectionLabel>
          {d.recent_events.length === 0 ? <Text style={[typography.meta, { color: colors.textMuted }]}>—</Text> : null}
          {d.recent_events.map((e, i) => (
            <SummaryRow key={i} k={t(`activity2.tr_${e.reason}`, { defaultValue: e.reason })}
              v={`${e.delta > 0 ? '+' : ''}${Math.round(e.delta * 100)} · ${formatDate(e.created_at, i18n.language)}`} />
          ))}
        </>
      )}
    </Screen>
  );
}

/** Server targets are `{route, id?}`; only these routes may be opened from a notification. */
const TARGET_ROUTES: Record<string, (id?: string) => [string, object | undefined] | null> = {
  Session: id => (id ? ['Session', { id }] : null),
  ReportDetail: id => (id ? ['ReportDetail', { id }] : null),
  SupportTicket: id => (id ? ['SupportTicket', { id }] : null),
  PrivacyRequests: () => ['PrivacyRequests', undefined],
  ParkingDetails: id => (id ? ['ParkingDetails', { id: Number(id) }] : null),
};

export function openTarget(n: AppNotification, navigate: (r: string, p?: object) => void) {
  const tg = (n.target ?? {}) as { route?: string; id?: string | number };
  const dest = tg.route ? TARGET_ROUTES[tg.route]?.(tg.id != null ? String(tg.id) : undefined) : null;
  if (dest) navigate(dest[0], dest[1]);
  else navigate('NotificationDetail', { id: n.id });
}

/** SCR: Notification centre (in-app inbox; push is only a delivery channel and is not configured in this build). */
export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const authed = useAuthed();
  const q = useNotifications(); // unread count (shared with the Explore bell)
  // Inbox keeps polling while open (no push provider): new reminders must appear without reopening (regression fix).
  const list = usePaged(qk.notifications, notificationsApi.list, authed, 30_000);
  const perm = usePrefsStore(s => s.notifPermission);
  const readAll = useMutation({ mutationFn: notificationsApi.readAll, onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notifications }) });
  const open = async (n: AppNotification) => {
    if (!n.is_read) { await notificationsApi.read(n.id).catch(() => undefined); void qc.invalidateQueries({ queryKey: qk.notifications }); }
    openTarget(n, navigation.navigate as unknown as (r: string, p?: object) => void);
  };
  const items = authed ? list.items : []; // never render a previous user's cached inbox
  return (
    <Screen testID="notifications-screen" onRefresh={() => Promise.all([list.refetch(), q.refetch()])} header={<ScreenHeader title={t('notif.title')} onBack={navigation.goBack} backLabel={t('common.back')}
      right={authed ? <ZpotButton variant="tertiary" label={t('notif.settings')} onPress={() => navigation.navigate('NotificationPrefs')} testID="notif-settings" /> : null} />}>
      {!authed ? <Banner tone="info" action={{ label: t('p2.signIn'), onPress: () => navigation.navigate('SignIn', { context: 'notifications' }) }}>{t('notif.guest')}</Banner> : null}
      {authed && perm !== 'granted' ? <Banner tone="info" testID="notif-perm-off">{t('notif.permOff')}</Banner> : null}
      {authed && (q.data?.unread_count ?? 0) > 0 ? <ZpotButton variant="small" label={t('notif.markAll')} onPress={() => readAll.mutate()} testID="notif-read-all" /> : null}
      {authed && list.isLoading ? <LoadingState skeleton={3} /> : authed && list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        : authed && items.length === 0 ? <EmptyState icon="bell" title={t('notif.title')} body={t('notif.empty')} testID="notif-empty" /> : null}
      {items.map(n => (
        <ListRow key={n.id} icon={n.is_read ? 'bell' : 'info'} label={n.title} testID={`notif-${n.template ?? n.id}`}
          sub={`${t(`notif.cat_${n.category}`)} · ${formatDate(n.created_at, i18n.language)} ${formatTime(n.created_at)}`}
          right={!n.is_read ? <View style={[styles.dot, { backgroundColor: palette.green700 }]} accessibilityLabel="unread"
            testID={`notif-unread-${n.template ?? n.id}`} /> : null}
          onPress={() => void open(n)} />
      ))}
      {list.hasNextPage ? <ZpotButton variant="small" label={t('common.loadMore')} loading={list.isFetchingNextPage}
        onPress={() => void list.fetchNextPage()} testID="notif-load-more" /> : null}
      <Text style={[typography.small, { color: colors.textSubtle }]}>{t('notif.pushSub')}</Text>
    </Screen>
  );
}

/** SCR: Notification detail (fallback when the target is gone or has no screen). */
export function NotificationDetailScreen({ navigation, route }: RootScreenProps<'NotificationDetail'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['notification', route.params.id], queryFn: () => notificationsApi.get(route.params.id) });
  const n = q.data;
  return (
    <Screen testID="notification-detail-screen" onRefresh={q.refetch} header={<ScreenHeader title={t('notif.detailTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {!n ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} />) : (
        <>
          <Text style={[typography.label, { color: colors.textMuted }]}>{t(`notif.cat_${n.category}`)}</Text>
          <Title size="h2">{n.title}</Title>
          <Text style={[typography.body, { color: colors.textBody }]}>{n.body}</Text>
          <Text style={[typography.meta, { color: colors.textMuted }]}>{`${formatDate(n.created_at, i18n.language)} ${formatTime(n.created_at)}`}</Text>
        </>
      )}
    </Screen>
  );
}

const PREF_ROWS: [keyof NotificationPrefs, string][] = [
  ['session_reminders', 'session'], ['rule_changes', 'rules'], ['report_updates', 'reports'], ['saved_locations', 'saved'], ['service_news', 'news'],
];

/** SCR: Notification preferences (persisted on the server; restriction alerts are essential). */
export function NotificationPrefsScreen({ navigation }: RootScreenProps<'NotificationPrefs'>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const perm = usePrefsStore(s => s.notifPermission);
  const q = useQuery({ queryKey: ['notif-prefs'], queryFn: notificationsApi.prefs });
  React.useEffect(() => { void syncNotifPermission(); }, []);
  const update = useMutation({ mutationFn: notificationsApi.updatePrefs, onSuccess: d => qc.setQueryData(['notif-prefs'], d) });
  const p = q.data;
  return (
    <Screen testID="notif-prefs-screen" onRefresh={q.refetch} header={<ScreenHeader title={t('notif.prefsTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <SectionLabel>{t('notif.permission')}</SectionLabel>
      <ListRow icon="bell" label={t('notif.permission')} testID="notif-permission"
        sub={perm === 'granted' ? t('notif.allowed') : perm === 'denied' ? t('notif.blocked') : t('notif.notAsked')}
        right={perm === 'denied' ? <ZpotButton variant="small" label={t('notif.openSettings')} onPress={() => void Linking.openSettings()} />
          : perm === 'unknown' ? <ZpotButton variant="small" label={t('notif.allow')} onPress={() => void requestNotifPermission()} testID="notif-allow" /> : null} />
      {!p ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />) : (
        <>
          <Toggle value label={t('notif.restriction')} sub={t('notif.restrictionSub')} onValueChange={() => undefined} disabled testID="pref-restriction" />
          {PREF_ROWS.map(([k, label]) => (
            <Toggle key={k} value={!!p[k]} label={t(`notif.${label}`)} sub={t(`notif.${label}Sub`)} testID={`pref-${k}`}
              onValueChange={v => update.mutate({ [k]: v })} />
          ))}
          <Toggle value={!!p.push_enabled} label={t('notif.push')} sub={t('notif.pushSub')} onValueChange={v => update.mutate({ push_enabled: v })} testID="pref-push" />
          {update.error ? <ErrorState error={update.error} /> : null}
        </>
      )}
    </Screen>
  );
}

/** Profile rows that only appear when the role/flag allows (scouts, Z-Trigger, Pro preview). */
export function useProfileExtras() {
  const { on } = useFeatures();
  const scout = useHasRole('scout');
  return { scout: scout && on('scouts'), zTrigger: on('z_trigger'), pro: on('pro') };
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  flex: { flex: 1 },
  mt: { marginTop: 6 },
  wrap: { flexWrap: 'wrap', marginTop: 8 },
  muted: { color: palette.slate500 },
  body: { marginBottom: 6 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.lg, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
