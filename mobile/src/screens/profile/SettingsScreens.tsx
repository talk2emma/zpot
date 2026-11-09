import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, errorMessage, FilterChip, Icon, ListRow, Screen, ScreenHeader, SectionLabel, Toggle, Wrap, ZpotButton, ZpotTextField } from '../../components/common';
import { toast } from '../../components/common/Toast';
import { APP } from '../../constants/app';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { type ParkingPrefs, usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, typography, useTheme } from '../../theme';

export function AccountSettingsScreen({ navigation }: RootScreenProps<'AccountSettings'>) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { setUser(await authApi.updateMe({ display_name: name.trim() })); toast(t('profile.nameSaved')); }
    catch (e) { setErr(errorMessage(e, t)); } finally { setBusy(false); }
  };
  return (
    <Screen testID="account-settings-screen" header={<ScreenHeader title={t('profile.account')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <ZpotTextField label={t('auth.email')} value={user?.email ?? ''} editable={false} testID="account-email" />
      <ZpotTextField label={t('profile.displayName')} value={name} onChangeText={setName} maxLength={80} testID="account-name" />
      <ZpotButton variant="small" label={t('profile.saveName')} onPress={save} loading={busy} testID="account-save-name" />
      {err ? <Banner tone="error">{err}</Banner> : null}
      <ListRow icon="trash" label={t('profile.deleteAccount')} danger onPress={() => navigation.navigate('DeleteAccount')} testID="account-delete" />
    </Screen>
  );
}

/** Parking preferences: local for guests; synced to /users/me/preferences/ when signed in. */
export function ParkingPreferencesScreen({ navigation }: RootScreenProps<'ParkingPreferences'>) {
  const { t } = useTranslation();
  const authed = useAuthStore(s => s.status === 'authenticated');
  const { parking, setParking } = usePrefsStore();
  const setFilters = useSearchStore(s => s.setFilters);
  const qc = useQueryClient();
  const remote = useQuery({ queryKey: ['preferences'], queryFn: authApi.preferences, enabled: authed });
  useEffect(() => {
    const r = remote.data;
    if (r) setParking({ maxWalk: r.max_walk_minutes, freeOnlyDefault: r.free_only_default, offerPaidAlternatives: r.offer_paid_alternatives,
      permitType: r.permit_type, hasDisabledBadge: r.has_disabled_badge, vehicleClass: r.vehicle_class });
  }, [remote.data, setParking]);

  const update = async (p: Partial<ParkingPrefs>) => {
    setParking(p);
    if (p.maxWalk !== undefined) setFilters({ maxWalk: p.maxWalk });
    if (p.freeOnlyDefault !== undefined) setFilters({ freeOnly: p.freeOnlyDefault });
    if (!authed) return;
    try {
      await authApi.updatePreferences({ max_walk_minutes: p.maxWalk, free_only_default: p.freeOnlyDefault,
        offer_paid_alternatives: p.offerPaidAlternatives, permit_type: p.permitType, has_disabled_badge: p.hasDisabledBadge });
      void qc.invalidateQueries({ queryKey: ['preferences'] });
      toast(t('profile.prefsSynced'));
    } catch (e) { toast(errorMessage(e, t)); }
  };

  return (
    <Screen testID="parking-prefs-screen" header={<ScreenHeader title={t('profile.parkingPrefs')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <SectionLabel>{t('profile.walk')}</SectionLabel>
      <Wrap>{APP.walkChoices.map(w => <FilterChip key={w} label={`${w} min`} selected={parking.maxWalk === w} onPress={() => update({ maxWalk: w })} testID={`pref-walk-${w}`} />)}</Wrap>
      <Toggle label={t('profile.freeDefault')} value={parking.freeOnlyDefault} onValueChange={v => update({ freeOnlyDefault: v })} testID="pref-free-default" />
      <Toggle label={t('profile.offerPaid')} sub={t('profile.offerPaidSub')} value={parking.offerPaidAlternatives} onValueChange={v => update({ offerPaidAlternatives: v })} testID="pref-offer-paid" />
      <SectionLabel>{t('profile.permit')}</SectionLabel>
      <Wrap>
        <FilterChip label={t('plan.noPermit')} selected={!parking.permitType} onPress={() => update({ permitType: null })} testID="pref-permit-none" />
        <FilterChip label={t('plan.residentPermit')} selected={parking.permitType === 'lisbon-resident-saldanha'} onPress={() => update({ permitType: 'lisbon-resident-saldanha' })} testID="pref-permit-resident" />
      </Wrap>
      <Toggle label={t('profile.badge')} sub={t('profile.badgeSub')} value={parking.hasDisabledBadge} onValueChange={v => update({ hasDisabledBadge: v })} testID="pref-badge" />
      <Text style={[typography.meta, { color: palette.slate500 }]}>{t('profile.prefsNote')}</Text>
    </Screen>
  );
}

export function PrivacyScreen({ navigation }: RootScreenProps<'Privacy'>) {
  const { t } = useTranslation();
  const authed = useAuthStore(s => s.status === 'authenticated');
  const status = usePrefsStore(s => s.locationStatus);
  const qc = useQueryClient();
  const remote = useQuery({ queryKey: ['preferences'], queryFn: authApi.preferences, enabled: authed });
  const toggle = async (field: 'personalised_results' | 'analytics_opt_in', v: boolean) => {
    try { await authApi.updatePreferences({ [field]: v }); void qc.invalidateQueries({ queryKey: ['preferences'] }); }
    catch (e) { toast(errorMessage(e, t)); }
  };
  return (
    <Screen testID="privacy-screen" header={<ScreenHeader title={t('profile.privacy')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <ListRow icon="crosshair" label={t('profile.locationRow')} sub={t(`loc.${status}`)} onPress={() => void Linking.openSettings()} testID="privacy-location" />
      <ListRow icon="bell" label={t('profile.notifications')} sub={t('notifIntro.body')} onPress={() => navigation.navigate('NotificationsIntro')} />
      {authed && remote.data ? (
        <>
          <Toggle label={t('profile.personalised')} value={remote.data.personalised_results} onValueChange={v => void toggle('personalised_results', v)} testID="privacy-personalised" />
          <Toggle label={t('profile.analytics')} value={remote.data.analytics_opt_in} onValueChange={v => void toggle('analytics_opt_in', v)} testID="privacy-analytics" />
        </>
      ) : null}
      <ListRow icon="file" label={t('profile.privacyNotice')} onPress={() => navigation.navigate('Legal', { tab: 'privacy' })} />
      <ListRow icon="trash" danger label={t('profile.deleteAccount')} onPress={() => navigation.navigate('DeleteAccount')} testID="privacy-delete" />
    </Screen>
  );
}

export function HelpScreen({ navigation }: RootScreenProps<'Help'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Screen testID="help-screen" header={<ScreenHeader title={t('help.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[styles.faq, { borderBottomColor: colors.divider }]}>
          <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }}
            style={styles.faqQ} testID={`help-q${i}`}>
            <Text style={[typography.bodyStrong, styles.flex, { color: colors.text, fontSize: 16 }]}>{t(`help.q${i}`)}</Text>
            <Icon name={open === i ? 'chevronUp' : 'chevronDown'} color={colors.text} />
          </Pressable>
          {open === i ? <Text style={[typography.body, { color: colors.textBody }]}>{t(`help.a${i}`)}</Text> : null}
        </View>
      ))}
    </Screen>
  );
}

type LegalTab = 'terms' | 'privacy' | 'sources' | 'disclaimer';
export function LegalScreen({ navigation, route }: RootScreenProps<'Legal'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [tab, setTab] = useState<LegalTab>(route.params?.tab ?? 'terms');
  const paras = t(`legal.${tab}P`, { returnObjects: true }) as unknown as string[];
  return (
    <Screen testID="legal-screen" header={<ScreenHeader title={t('legal.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <Wrap>{(['terms', 'privacy', 'sources', 'disclaimer'] as LegalTab[]).map(k => (
        <FilterChip key={k} label={t(`legal.${k}`)} selected={tab === k} onPress={() => setTab(k)} testID={`legal-tab-${k}`} />
      ))}</Wrap>
      <Banner tone="warn">{t('legal.draft')}</Banner>
      <Text style={[typography.h2, { color: colors.text }]}>{t(`legal.${tab}Title`)}</Text>
      {Array.isArray(paras) ? paras.map((p, i) => <Text key={i} style={[typography.body, { color: colors.textBody }]}>{p}</Text>) : null}
    </Screen>
  );
}

export function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { status, clearLocalSession } = useAuthStore();
  const resetDevice = usePrefsStore(s => s.resetDeviceData);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const authed = status === 'authenticated';
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      if (authed) await authApi.deleteMe(text.trim());
      await clearLocalSession(false);
      resetDevice();
      toast(authed ? t('profile.deleted') : t('profile.cleared'));
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) { setErr(errorMessage(e, t)); } finally { setBusy(false); }
  };
  return (
    <Screen testID="delete-account-screen" header={<ScreenHeader title={t('profile.deleteTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton variant="danger" label={t('profile.deleteCta')} disabled={text.trim().toUpperCase() !== 'DELETE'} loading={busy} onPress={go} testID="delete-confirm" />}>
      <View style={[styles.warn, { backgroundColor: palette.red50 }]}>
        <Text style={[typography.body, { color: colors.textBody }]}>{authed ? t('profile.deleteBody') : t('profile.deleteGuestBody')}</Text>
      </View>
      <ZpotTextField label="DELETE" value={text} onChangeText={setText} autoCapitalize="characters" testID="delete-input" />
      {err ? <Banner tone="error">{err}</Banner> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  faq: { borderBottomWidth: 1, paddingVertical: 8, gap: 6 },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  flex: { flex: 1 },
  warn: { padding: 14, borderRadius: radius.lg },
});
