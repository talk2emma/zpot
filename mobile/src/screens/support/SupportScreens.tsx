import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Banner, Body, ConfirmDialog, EmptyState, ErrorState, FilterChip, Icon, ListRow, LoadingState, Screen, ScreenHeader, SectionLabel,
  SummaryRow, Title, Toggle, Wrap, ZpotButton, ZpotTextField,
} from '../../components/common';
import { toast } from '../../components/common/Toast';
import { PhotoField } from '../../components/forms/PhotoField';
import { APP } from '../../constants/app';
import { useAuthed } from '../../hooks/useAccount';
import { usePaged } from '../../hooks/usePaged';
import type { RootScreenProps } from '../../navigation/types';
import { authApi, detectionApi, parkingApi, privacyApi, scoutsApi, supportApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import type { DraftPhoto } from '../../store/reportDraftStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, typography, useTheme } from '../../theme';
import type { ParkEvent, TicketCategory } from '../../types/contracts';
import { formatDate, formatTime } from '../../utils/time';

const lang = (l: string) => (l.startsWith('pt') ? 'pt-PT' : 'en');

/** SCR: Help centre — articles from /help/articles/ (bilingual, admin-managed) + support entry points. */
export function HelpScreen({ navigation }: RootScreenProps<'Help'>) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['help', lang(i18n.language)], queryFn: () => supportApi.articles(lang(i18n.language)) });
  const authed = useAuthed();
  return (
    <Screen testID="help-screen" header={<ScreenHeader title={t('support.helpCentre')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <SectionLabel>{t('support.faq')}</SectionLabel>
      {q.isLoading ? <LoadingState skeleton={3} /> : q.isError ? <ErrorState error={q.error} title={t('support.articleLoadError')} onRetry={() => void q.refetch()} /> : null}
      {(q.data ?? []).map(a => (
        <ListRow key={a.id} icon="help" label={a.title} onPress={() => navigation.navigate('HelpArticle', { id: a.id })} testID={`help-article-${a.slug}`} />
      ))}
      <SectionLabel>{t('support.contact')}</SectionLabel>
      <ListRow icon="mail" label={t('support.contact')} onPress={() => navigation.navigate('ContactSupport', { mode: 'support' })} testID="help-contact" />
      <ListRow icon="flag" label={t('support.guidance')} onPress={() => navigation.navigate('ContactSupport', { mode: 'guidance' })} testID="help-guidance" />
      {authed ? <ListRow icon="list" label={t('support.myRequests')} onPress={() => navigation.navigate('SupportTickets')} testID="help-tickets" /> : null}
    </Screen>
  );
}

export function HelpArticleScreen({ navigation, route }: RootScreenProps<'HelpArticle'>) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['help', route.params.id, lang(i18n.language)], queryFn: () => supportApi.article(route.params.id, lang(i18n.language)) });
  return (
    <Screen testID="help-article-screen" header={<ScreenHeader onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton variant="secondary" label={t('support.contact')} onPress={() => navigation.navigate('ContactSupport', { mode: 'support' })} />}>
      {q.data ? (<><Title size="h2">{q.data.title}</Title>{q.data.body.split(/\n{2,}/).map((p, i) => <Body key={i}>{p}</Body>)}</>)
        : q.isLoading ? <LoadingState /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
    </Screen>
  );
}

const SUPPORT_TOPICS: TicketCategory[] = ['account', 'map_search', 'reports', 'privacy', 'other'];
const GUIDANCE_TOPICS: TicketCategory[] = ['wrong_rule', 'wrong_price', 'got_fine'];

/** SCR: Contact support / report a guidance problem. Context is only attached with explicit consent. */
export function ContactSupportScreen({ navigation, route }: RootScreenProps<'ContactSupport'>) {
  const { mode = 'support', areaId, areaName } = route.params ?? {};
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const authed = useAuthed();
  const destination = useSearchStore(s => s.destination);
  const selected = useSearchStore(s => s.selectedId);
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [desc, setDesc] = useState('');
  const [email, setEmail] = useState('');
  const [ctx, setCtx] = useState(mode === 'guidance');
  const [shot, setShot] = useState<DraftPhoto | null>(null);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const topics = mode === 'guidance' ? GUIDANCE_TOPICS : SUPPORT_TOPICS;
  const errs = { topic: !category ? t('support.topicErr') : undefined, desc: desc.trim().length < 15 ? t('support.describeErr') : undefined,
    email: !authed && !/^\S+@\S+\.\S+$/.test(email.trim()) ? t('auth.errEmail') : undefined };
  const send = useMutation({
    mutationFn: async () => {
      const ticket = await supportApi.create({ category: category!, description: desc.trim(), contact_email: authed ? undefined : email.trim(),
        include_context: ctx, context: ctx ? { area_id: areaId ?? selected ?? undefined, search: destination?.name, platform: Platform.OS,
          language: i18n.language, app_version: APP.version } : {} });
      if (shot) await supportApi.attach(ticket.id, shot).catch(() => undefined);
      return ticket;
    },
    onSuccess: tk => { setSent(tk.reference); void qc.invalidateQueries({ queryKey: ['tickets'] }); },
  });
  if (sent) {
    return (
      <Screen testID="support-sent-screen" header={<ScreenHeader onBack={navigation.goBack} close backLabel={t('common.close')} />}
        footer={<ZpotButton label={t('common.done')} onPress={navigation.goBack} testID="support-done" />}>
        <View style={[styles.ok, { backgroundColor: palette.green50 }]}><Icon name="check" size={30} color={palette.green700} /></View>
        <Title>{t('support.sentTitle')}</Title>
        <Body>{t('support.sentBody', { ref: sent })}</Body>
        {authed ? <ZpotButton variant="tertiary" label={t('support.myRequests')} onPress={() => navigation.replace('SupportTickets')} testID="support-to-tickets" /> : null}
      </Screen>
    );
  }
  const ok = !errs.topic && !errs.desc && !errs.email;
  return (
    <Screen testID="contact-support-screen" header={<ScreenHeader title={mode === 'guidance' ? t('support.guidance') : t('support.contact')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton label={send.isPending ? t('support.sending') : t('support.send')} loading={send.isPending}
        onPress={() => (ok ? send.mutate() : setTouched(true))} testID="support-send" />}>
      <SectionLabel>{t('support.topic')}</SectionLabel>
      <Wrap>{topics.map(c => <FilterChip key={c} label={t(`support.t_${c}`)} selected={category === c} onPress={() => setCategory(c)} testID={`support-topic-${c}`} />)}</Wrap>
      {touched && errs.topic ? <Text style={[typography.meta, { color: palette.red600 }]}>{errs.topic}</Text> : null}
      <ZpotTextField label={t('support.describe')} value={desc} onChangeText={setDesc} multiline maxLength={3000} error={touched ? errs.desc : undefined} testID="support-description" />
      {!authed ? <ZpotTextField label={t('support.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        error={touched ? errs.email : undefined} testID="support-email" /> : <SummaryRow k={t('support.email')} v={user?.email ?? ''} />}
      <Toggle value={ctx} onValueChange={setCtx} testID="support-context"
        label={t('support.includeCtx', { ctx: areaName ? t('support.ctxPlace', { place: areaName }) : t('support.ctxSession') })} />
      <PhotoField value={shot} onChange={setShot} label={t('support.screenshot')} testID="support-photo" />
      {send.error ? <ErrorState error={send.error} testID="support-error" /> : null}
    </Screen>
  );
}

export function SupportTicketsScreen({ navigation }: RootScreenProps<'SupportTickets'>) {
  const { t, i18n } = useTranslation();
  const q = usePaged(['tickets'], supportApi.tickets);
  const items = q.items;
  return (
    <Screen testID="support-tickets-screen" header={<ScreenHeader title={t('support.myRequests')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {q.isLoading ? <LoadingState skeleton={2} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : items.length === 0 ? <EmptyState icon="mail" title={t('support.myRequests')} body={t('support.noRequests')} /> : null}
      {items.map(tk => (
        <ListRow key={tk.id} icon="mail" label={t(`support.t_${tk.category}`)} sub={`${tk.reference} · ${formatDate(tk.created_at, i18n.language)}`}
          value={t(`support.status_${tk.status}`)} onPress={() => navigation.navigate('SupportTicket', { id: tk.id })} testID={`ticket-${tk.reference}`} />
      ))}
      {q.hasNextPage ? <ZpotButton variant="small" label={t('common.loadMore')} loading={q.isFetchingNextPage}
        onPress={() => void q.fetchNextPage()} testID="tickets-load-more" /> : null}
    </Screen>
  );
}

export function SupportTicketScreen({ navigation, route }: RootScreenProps<'SupportTicket'>) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['ticket', route.params.id], queryFn: () => supportApi.ticket(route.params.id) });
  const tk = q.data;
  return (
    <Screen testID="support-ticket-screen" header={<ScreenHeader title={tk?.reference} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {!tk ? (q.isLoading ? <LoadingState /> : <ErrorState error={q.error} />) : (
        <>
          <SummaryRow k={t('support.topic')} v={t(`support.t_${tk.category}`)} />
          <SummaryRow k={t('report.history')} v={t(`support.status_${tk.status}`)} />
          <SummaryRow k={formatDate(tk.created_at, i18n.language)} v={formatTime(tk.created_at)} />
          <Body>{tk.description}</Body>
          {tk.staff_reply ? (<><SectionLabel>{t('support.reply')}</SectionLabel><Banner tone="info" testID="ticket-reply">{tk.staff_reply}</Banner></>) : null}
        </>
      )}
    </Screen>
  );
}

/** SCR: Privacy & permissions — consents ledger, export, requests and deletion. */
export function PrivacyScreen({ navigation }: RootScreenProps<'Privacy'>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const authed = useAuthed();
  const status = usePrefsStore(s => s.locationStatus);
  const notif = usePrefsStore(s => s.notifPermission);
  const consents = useQuery({ queryKey: ['consents'], queryFn: privacyApi.consents, enabled: authed });
  const prefs = useQuery({ queryKey: ['preferences'], queryFn: authApi.preferences, enabled: authed });
  const setConsent = useMutation({ mutationFn: privacyApi.updateConsents, onSuccess: d => { qc.setQueryData(['consents'], d); void qc.invalidateQueries({ queryKey: ['preferences'] }); } });
  const setPref = useMutation({ mutationFn: (v: boolean) => authApi.updatePreferences({ personalised_results: v }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['preferences'] }) });
  const exp = useMutation({ mutationFn: privacyApi.requestExport, onSuccess: r => { toast(t('privacy2.exportRequested', { ref: r.reference })); void qc.invalidateQueries({ queryKey: ['privacy-requests'] }); } });
  const c = consents.data;
  return (
    <Screen testID="privacy-screen" header={<ScreenHeader title={t('privacy2.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <SectionLabel>{t('privacy2.permissions')}</SectionLabel>
      <ListRow icon="crosshair" label={t('privacy2.location')} sub={t(`loc.${status}`)} onPress={() => void Linking.openSettings()} testID="privacy-location" />
      <ListRow icon="bell" label={t('privacy2.notifications')} sub={notif === 'granted' ? t('notif.allowed') : notif === 'denied' ? t('notif.blocked') : t('notif.notAsked')}
        onPress={() => (authed ? navigation.navigate('NotificationPrefs') : navigation.navigate('NotificationsIntro'))} testID="privacy-notifs" />
      <ListRow icon="eye" label={t('privacy2.camera')} sub={t('privacy2.cameraSub')} onPress={() => void Linking.openSettings()} testID="privacy-camera" />
      {authed ? (
        <>
          <SectionLabel>{t('privacy2.consents')}</SectionLabel>
          {c ? (
            <>
              <Toggle label={t('privacy2.analytics')} sub={t('privacy2.analyticsSub')} value={c.analytics?.granted ?? false}
                onValueChange={v => setConsent.mutate({ analytics: v })} testID="privacy-analytics" />
              <Toggle label={t('privacy2.ads')} sub={t('privacy2.adsSub')} value={c.personalised_ads?.granted ?? false}
                onValueChange={v => setConsent.mutate({ personalised_ads: v })} testID="privacy-ads" />
            </>
          ) : consents.isLoading ? <LoadingState /> : <ErrorState error={consents.error} onRetry={() => void consents.refetch()} />}
          {prefs.data ? <Toggle label={t('privacy2.personalised')} value={prefs.data.personalised_results} onValueChange={v => setPref.mutate(v)} testID="privacy-personalised" /> : null}
          {setConsent.error ? <ErrorState error={setConsent.error} /> : null}
          <SectionLabel>{t('privacy2.dataControls')}</SectionLabel>
          <ListRow icon="file" label={t('privacy2.export')} sub={t('privacy2.exportSub')} onPress={() => exp.mutate()} testID="privacy-export" />
          {exp.error ? <ErrorState error={exp.error} testID="privacy-export-error" /> : null}
          <ListRow icon="list" label={t('privacy2.requests')} onPress={() => navigation.navigate('PrivacyRequests')} testID="privacy-requests" />
        </>
      ) : null}
      <ListRow icon="file" label={t('profile.privacyNotice')} onPress={() => navigation.navigate('Legal', { tab: 'privacy' })} />
      <ListRow icon="trash" danger label={t('privacy2.deleteData')} onPress={() => navigation.navigate('DeleteAccount')} testID="privacy-delete" />
      <Text style={[typography.small, { color: palette.slate500 }]}>{t('privacy2.legalNote')}</Text>
    </Screen>
  );
}

export function PrivacyRequestsScreen({ navigation }: RootScreenProps<'PrivacyRequests'>) {
  const { t, i18n } = useTranslation();
  // Poll only while a request is still being prepared.
  const q = useQuery({ queryKey: ['privacy-requests'], queryFn: privacyApi.requests,
    refetchInterval: x => ((x.state.data ?? []).some(r => r.status === 'received' || r.status === 'processing') ? 10_000 : false) });
  const share = async (id: string, ref: string) => {
    try { const text = await privacyApi.download(id); await Share.share({ title: `zpot-export-${ref}.json`, message: text }); }
    catch { toast(t('common.somethingWrong')); }
  };
  const items = q.data ?? [];
  return (
    <Screen testID="privacy-requests-screen" header={<ScreenHeader title={t('privacy2.requests')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : items.length === 0 ? <EmptyState icon="file" title={t('privacy2.requests')} body={t('privacy2.noRequests')} /> : null}
      {items.map(r => (
        <ListRow key={r.id} icon="file" label={t(`privacy2.kind_${r.kind}`)} sub={`${r.reference} · ${formatDate(r.created_at, i18n.language)}`}
          value={t(`privacy2.st_${r.status}`)} testID={`privacy-request-${r.reference}`}
          right={r.download_available ? <ZpotButton variant="small" label={t('privacy2.download')} onPress={() => void share(r.id, r.reference)} testID={`privacy-download-${r.reference}`} /> : null} />
      ))}
    </Screen>
  );
}

/** Deletion goes through /privacy/deletion-request/ (anonymises reports, deletes the account, audited). */
export function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { status, clearLocalSession } = useAuthStore();
  const resetDevice = usePrefsStore(s => s.resetDeviceData);
  const [text, setText] = useState('');
  const authed = status === 'authenticated';
  const del = useMutation({
    mutationFn: async () => { if (authed) await privacyApi.requestDeletion(text.trim()); },
    onSuccess: async () => {
      await clearLocalSession(false);
      resetDevice();
      toast(authed ? t('profile.deleted') : t('profile.cleared'));
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    },
  });
  return (
    <Screen testID="delete-account-screen" header={<ScreenHeader title={t('profile.deleteTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton variant="danger" label={t('profile.deleteCta')} disabled={text.trim().toUpperCase() !== 'DELETE'} loading={del.isPending}
        onPress={() => del.mutate()} testID="delete-confirm" />}>
      <View style={[styles.warn, { backgroundColor: palette.red50 }]}>
        <Text style={[typography.body, { color: colors.textBody }]}>{authed ? t('profile.deleteBody') : t('profile.deleteGuestBody')}</Text>
      </View>
      <ZpotTextField label="DELETE" value={text} onChangeText={setText} autoCapitalize="characters" testID="delete-input" />
      {del.error ? <ErrorState error={del.error} /> : null}
    </Screen>
  );
}

/** SCR: Scout task list (role + flag guarded on the server). */
export function ScoutListScreen({ navigation }: RootScreenProps<'ScoutList'>) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['scout-tasks'], queryFn: scoutsApi.list });
  const items = q.data ?? [];
  return (
    <Screen testID="scout-list-screen" header={<ScreenHeader title={t('scout.tasks')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : items.length === 0 ? <EmptyState icon="flag" title={t('scout.tasks')} body={t('scout.empty')} /> : null}
      {items.map(a => (
        <ListRow key={a.id} icon="pin" label={(a.area as { name: string }).name} sub={a.reason} value={t(`scout.${a.status ?? 'assigned'}`)}
          onPress={() => navigation.navigate('ScoutTask', { id: a.id })} testID={`scout-task-${a.id}`} />
      ))}
    </Screen>
  );
}

export function ScoutTaskScreen({ navigation, route }: RootScreenProps<'ScoutTask'>) {
  const { id } = route.params;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['scout-task', id], queryFn: () => scoutsApi.get(id) });
  const [outcome, setOutcome] = useState<'matches' | 'differs' | 'no_access' | null>(null);
  const [observed, setObserved] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<DraftPhoto | null>(null);
  const [touched, setTouched] = useState(false);
  const errs = [!outcome && t('scout.errOutcome'), outcome && outcome !== 'no_access' && !photo && t('scout.errPhoto'),
    outcome === 'differs' && observed.trim().length < 10 && t('scout.errObserved')].filter(Boolean) as string[];
  const submit = useMutation({
    mutationFn: () => scoutsApi.submit(id, { outcome: outcome!, observed_rules: observed.trim(), notes: notes.trim(), photos: photo ? [photo] : [] }),
    onSuccess: a => { qc.setQueryData(['scout-task', id], a); void qc.invalidateQueries({ queryKey: ['scout-tasks'] }); toast(t('scout.submittedToast')); navigation.goBack(); },
  });
  const a = q.data;
  if (!a) return <Screen header={<ScreenHeader onBack={navigation.goBack} />}>{q.isLoading ? <LoadingState /> : <ErrorState error={q.error} />}</Screen>;
  const open = a.status === 'assigned' || a.status === 'rejected';
  return (
    <Screen testID="scout-task-screen" header={<ScreenHeader title={(a.area as { name: string }).name} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={open ? <ZpotButton label={t('scout.submit')} loading={submit.isPending} onPress={() => (errs.length ? setTouched(true) : submit.mutate())} testID="scout-submit" /> : undefined}>
      <SummaryRow k={t('scout.why')} v={a.reason} />
      <SectionLabel>{t('scout.onFile')}</SectionLabel>
      {a.current_rules.map((r, i) => <Body key={i}>{`• ${r}`}</Body>)}
      {a.last_submission ? <Banner tone="info">{`${t(`scout.${a.status}`)}${(a.last_submission as { review_note?: string }).review_note ? ` — ${(a.last_submission as { review_note: string }).review_note}` : ''}`}</Banner> : null}
      {open ? (
        <>
          <SectionLabel>{t('scout.outcome')}</SectionLabel>
          <Wrap>{(['matches', 'differs', 'no_access'] as const).map(o => (
            <FilterChip key={o} label={t(`scout.${o === 'no_access' ? 'noAccess' : o}`)} selected={outcome === o} onPress={() => setOutcome(o)} testID={`scout-outcome-${o}`} />
          ))}</Wrap>
          {outcome === 'differs' ? <ZpotTextField label={t('scout.observed')} value={observed} onChangeText={setObserved} multiline testID="scout-observed" /> : null}
          <ZpotTextField label={t('scout.notes')} value={notes} onChangeText={setNotes} multiline testID="scout-notes" />
          <PhotoField value={photo} onChange={setPhoto} label={t('scout.photoReq')} testID="scout-photo" />
          {touched && errs.length ? <Banner tone="error" testID="scout-errors">{errs.join(' · ')}</Banner> : null}
          {submit.error ? <ErrorState error={submit.error} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

/** SCR: Z-Trigger (experimental, off by default). No native Bluetooth detection exists in this build. */
export function ZTriggerScreen({ navigation }: RootScreenProps<'ZTrigger'>) {
  const { t } = useTranslation();
  const cfg = useQuery({ queryKey: ['detection-config'], queryFn: detectionApi.config });
  const center = useSearchStore(s => s.origin ?? s.destination);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [declined, setDeclined] = useState(false);
  const sim = useMutation({
    mutationFn: () => detectionApi.report({ latitude: center?.latitude ?? 38.7369, longitude: center?.longitude ?? -9.1427,
      detected_at: new Date().toISOString(), source: 'manual_test' }),
    onSuccess: (e: ParkEvent) => { void hist.refetch(); openEvent(e); },
  });
  const hist = useQuery({ queryKey: ['z-history'], queryFn: detectionApi.history });
  const [del, setDel] = useState(false);
  const wipe = useMutation({ mutationFn: detectionApi.deleteAll, onSuccess: r => { setDel(false); toast(t('z2.deleted', { n: r.deleted })); void hist.refetch(); } });
  const openEvent = (e: ParkEvent) => navigation.navigate('ZEvent', { id: e.id, at: e.detected_at, areaId: (e.area as { id?: number } | null)?.id,
    areaName: (e.area as { name?: string } | null)?.name, ...(e.location as { latitude: number; longitude: number }) });
  const enabled = !!cfg.data?.enabled;
  return (
    <Screen testID="ztrigger-screen" header={<ScreenHeader title={t('z.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <Title size="h2">{t('z.introTitle')}</Title>
      <Body>{t('z.introBody')}</Body>
      <Banner tone="warn" testID="ztrigger-native-note">{t('z.nativeNote')}</Banner>
      {cfg.data?.limitations?.length ? (<><SectionLabel>{t('z.limits')}</SectionLabel>{cfg.data.limitations.map((l, i) => <Body key={i} muted>{`• ${l}`}</Body>)}</>) : null}
      <SummaryRow k={t('z.status')} v={enabled ? t('z.on') : t('z.off')} />
      {!enabled ? <Banner tone="info" testID="ztrigger-disabled">{t('z.disabledFlag')}</Banner> : declined ? <Banner tone="info">{t('z.declined')}</Banner> : (
        <>
          <SectionLabel>{t('z.consentTitle')}</SectionLabel>
          <Toggle value={c1} onValueChange={setC1} label={t('z.consentBg')} testID="z-consent-1" />
          <Toggle value={c2} onValueChange={setC2} label={t('z.consentPrivate')} testID="z-consent-2" />
          <ZpotButton label={t('z.simulate')} disabled={!c1 || !c2} loading={sim.isPending} onPress={() => sim.mutate()} testID="z-simulate" />
          <ZpotButton variant="tertiary" label={t('z.decline')} onPress={() => setDeclined(true)} testID="z-decline" />
          {sim.error ? <ErrorState error={sim.error} /> : null}
        </>
      )}
      <SectionLabel>{t('z2.history')}</SectionLabel>
      {(hist.data ?? []).length === 0 ? <Body muted>{t('z2.noEvents')}</Body> : null}
      {(hist.data ?? []).map(e => (
        <ListRow key={e.id} icon="clock" label={(e.area as { name?: string } | null)?.name ?? '—'} testID={`z-event-${e.id}`}
          sub={`${formatTime(e.detected_at)} · ${t(`z2.st_${e.status}`)}`} onPress={e.status === 'detected' && enabled ? () => openEvent(e) : undefined} />
      ))}
      <SectionLabel>{t('z2.troubleTitle')}</SectionLabel>
      <Body muted>{t('z2.trouble')}</Body>
      {(hist.data ?? []).length ? <ZpotButton variant="small" icon="trash" label={t('z2.delete')} onPress={() => setDel(true)} testID="z-delete" /> : null}
      <ConfirmDialog visible={del} title={t('z2.deleteQ')} confirmLabel={t('z2.delete')} cancelLabel={t('common.cancel')} destructive
        onCancel={() => setDel(false)} onConfirm={() => wipe.mutate()} testID="z-delete-dialog" />
    </Screen>
  );
}

export function ZEventScreen({ navigation, route }: RootScreenProps<'ZEvent'>) {
  const { id, at, areaId, areaName, latitude, longitude } = route.params;
  const { t } = useTranslation();
  const confirm = useMutation({ mutationFn: () => detectionApi.confirm(id), onSuccess: () => {
    if (place.areaId) navigation.replace('StartSession', { areaId: place.areaId }); else navigation.goBack();
  } });
  const dismiss = useMutation({ mutationFn: () => detectionApi.dismiss(id), onSuccess: () => navigation.goBack() });
  const [picking, setPicking] = useState(false);
  const [place, setPlace] = useState({ areaId, areaName });
  const near = useQuery({ queryKey: ['z-near', latitude, longitude], enabled: picking && latitude != null,
    queryFn: () => parkingApi.options({ latitude: latitude!, longitude: longitude!, duration_minutes: 60, max_walk_minutes: 5, include_paid: true, limit: 8 }) });
  const correct = useMutation({ mutationFn: (o: { id: number; name: string; location: { latitude: number; longitude: number } }) =>
    detectionApi.correct(id, o.location.latitude, o.location.longitude).then(() => o),
    onSuccess: o => { setPlace({ areaId: o.id, areaName: o.name }); setPicking(false); toast(t('z2.corrected')); } });
  return (
    <Screen testID="zevent-screen" header={<ScreenHeader onBack={navigation.goBack} close backLabel={t('common.close')} />}
      footer={<>
        <ZpotButton label={t('z.confirm')} loading={confirm.isPending} onPress={() => confirm.mutate()} testID="zevent-confirm" />
        <ZpotButton variant="secondary" label={t('z.dismiss')} loading={dismiss.isPending} onPress={() => dismiss.mutate()} testID="zevent-dismiss" />
      </>}>
      <Title>{t('z.eventTitle')}</Title>
      <Body>{t('z.eventBody', { time: formatTime(at), place: place.areaName ?? '—' })}</Body>
      <Body muted>{t('z2.confirmNote')}</Body>
      {latitude != null ? <ZpotButton variant="small" icon="pin" label={t('z2.correct')} onPress={() => setPicking(p => !p)} testID="zevent-correct" /> : null}
      {picking ? (
        <>
          <SectionLabel>{t('z2.pickArea')}</SectionLabel>
          {near.isLoading ? <LoadingState /> : null}
          {(near.data?.results ?? []).map(o => (
            <ListRow key={o.id} icon="pin" label={o.name} sub={t(`category.${o.category}`)} onPress={() => correct.mutate(o)} testID={`zevent-area-${o.id}`} />
          ))}
          {correct.error ? <ErrorState error={correct.error} /> : null}
        </>
      ) : null}
      {confirm.error || dismiss.error ? <ErrorState error={confirm.error ?? dismiss.error} /> : null}
    </Screen>
  );
}

/** SCR: Pro preview — informational only. No purchase can be made and nothing is unlocked. */
export function ProScreen({ navigation }: RootScreenProps<'Pro'>) {
  const { t } = useTranslation();
  const authed = useAuthed();
  return (
    <Screen testID="pro-screen" header={<ScreenHeader title={t('pro.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton label={t('pro.cta')} disabled testID="pro-cta" />}>
      <Body>{t('pro.body')}</Body>
      {['f1', 'f2', 'f3', 'f4'].map(k => <SummaryRow key={k} k={t(`pro.${k}`)} v="Pro" />)}
      <SummaryRow k={t('pro.annual')} v="" />
      <SummaryRow k={t('pro.monthly')} v="" />
      <Banner tone="warn" testID="pro-unavailable">{t('pro.unavailable')}</Banner>
      {authed ? <ZpotButton variant="tertiary" label={t('sub.restore')} onPress={() => navigation.navigate('ManageSubscription')} testID="pro-restore" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ok: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  warn: { padding: 14, borderRadius: radius.lg },
});

