import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, errorMessage, FilterChip, ListRow, Screen, ScreenHeader, SectionLabel, Toggle, Wrap, ZpotButton, ZpotTextField } from '../../components/common';
import { toast } from '../../components/common/Toast';
import { APP } from '../../constants/app';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { type ParkingPrefs, usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, typography, useTheme } from '../../theme';

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
