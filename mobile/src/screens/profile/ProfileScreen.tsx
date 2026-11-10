import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Banner, ConfirmDialog, ListRow, Title, ZpotButton } from '../../components/common';
import { toast } from '../../components/common/Toast';
import { APP } from '../../constants/app';
import { ENV } from '../../constants/env';
import { authApi, systemApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import { palette, typography, useTheme } from '../../theme';
import { useProfileExtras } from '../account/AccountScreens';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { status, user, signOut, sessionExpired } = useAuthStore();
  const language = usePrefsStore(s => s.language);
  const [confirm, setConfirm] = useState(false);
  const extras = useProfileExtras();
  const health = useQuery({ queryKey: ['health'], queryFn: systemApi.health, staleTime: 60_000, retry: 0 });
  const authed = status === 'authenticated' && user;
  const [refreshing, setRefreshing] = useState(false);
  /** Pull-to-refresh: re-read the account (e.g. email verified on another device) and the API status. */
  const pull = async () => {
    setRefreshing(true);
    try {
      await health.refetch();
      if (useAuthStore.getState().status === 'authenticated') useAuthStore.getState().setUser(await authApi.me());
    } catch { /* status line shows the API state */ } finally { setRefreshing(false); }
  };
  const name = authed ? (user.display_name || user.email.split('@')[0]) : t('profile.guest');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]} testID="profile-screen"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pull()} tintColor={palette.green700} colors={[palette.green700]}
        testID="profile-screen-refresh" />}>
      <Title>{t('profile.title')}</Title>
      {sessionExpired && !authed ? <Banner tone="warn" action={{ label: t('auth.signIn'), onPress: () => navigation.navigate('SignIn') }}>{t('auth.sessionExpired')}</Banner> : null}
      <View style={[styles.card, { backgroundColor: colors.surfaceMuted }]}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.flex}>
          <Text style={[typography.h2, { color: colors.text }]} testID="profile-name">{name}</Text>
          <Text style={[typography.meta, { color: colors.textMuted }]}>{authed ? user.email : t('profile.guestSub')}</Text>
        </View>
      </View>
      {authed && !user.is_email_verified ? (
        <Banner tone="warn" action={{ label: t('common.continue'), onPress: () => navigation.navigate('VerifyEmail', { email: user.email }) }}
          testID="profile-verify-banner">{t('profile.verifyBanner')}</Banner>
      ) : null}
      {!authed ? <ZpotButton label={t('profile.signInCta')} onPress={() => navigation.navigate('SignIn')} testID="profile-signin" /> : null}
      {authed ? <ListRow icon="user" label={t('profile.account')} onPress={() => navigation.navigate('AccountSettings')} testID="profile-account" /> : null}
      <ListRow icon="filter" label={t('profile.parkingPrefs')} onPress={() => navigation.navigate('ParkingPreferences')} testID="profile-prefs" />
      <ListRow icon="bell" label={t('profile.notifications')} onPress={() => navigation.navigate(authed ? 'NotificationPrefs' : 'NotificationsIntro')} testID="profile-notifs" />
      {authed ? <ListRow icon="user" label={t('p3.vehicles')} onPress={() => navigation.navigate('Vehicles')} testID="profile-vehicles" /> : null}
      {authed ? <ListRow icon="calendar" label={t('p3.commute')} onPress={() => navigation.navigate('Commute')} testID="profile-commute" /> : null}
      {authed ? <ListRow icon="euro" label={t('p3.insights')} onPress={() => navigation.navigate('Insights')} testID="profile-insights" /> : null}
      {authed ? <ListRow icon="star" label={t('p2.contributions')} onPress={() => navigation.navigate('Contributions')} testID="profile-contrib" /> : null}
      {authed && extras.scout ? <ListRow icon="pin" label={t('p2.scout')} onPress={() => navigation.navigate('ScoutList')} testID="profile-scout" /> : null}
      {extras.zTrigger ? <ListRow icon="settings" label={t('p2.ztrigger')} onPress={() => navigation.navigate('ZTrigger')} testID="profile-ztrigger" /> : null}
      {extras.pro ? <ListRow icon="star" label={t('p2.pro')} onPress={() => navigation.navigate('Pro')} testID="profile-pro" /> : null}
      {authed && extras.pro ? <ListRow icon="file" label={t('p3.subscription')} onPress={() => navigation.navigate('ManageSubscription')} testID="profile-subscription" /> : null}
      <ListRow icon="globe" label={t('profile.language')} value={language === 'pt-PT' ? 'Português' : 'English'}
        onPress={() => navigation.navigate('Language', { fromSettings: true })} testID="profile-language" />
      <ListRow icon="shield" label={t('profile.privacy')} onPress={() => navigation.navigate('Privacy')} testID="profile-privacy" />
      <ListRow icon="help" label={t('p2.helpCentre')} onPress={() => navigation.navigate('Help')} testID="profile-help" />
      <ListRow icon="mail" label={t('p2.contact')} onPress={() => navigation.navigate('ContactSupport', { mode: 'support' })} testID="profile-contact" />
      <ListRow icon="file" label={t('profile.legal')} onPress={() => navigation.navigate('Legal')} testID="profile-legal" />
      {authed ? <ListRow icon="logout" label={t('profile.signOut')} onPress={() => setConfirm(true)} testID="profile-signout" /> : null}
      <Text style={[typography.small, styles.ver, { color: colors.textSubtle }]} testID="profile-version">
        {t('profile.version', { v: APP.version, api: health.data ? health.data.version : health.isError ? 'unreachable' : '…' })}
        {ENV.showDevTools ? `\n${ENV.apiBaseUrl}` : ''}
      </Text>
      <ConfirmDialog visible={confirm} title={t('profile.signOutQ')} body={t('profile.signOutBody')} confirmLabel={t('profile.signOut')}
        cancelLabel={t('common.cancel')} onCancel={() => setConfirm(false)} testID="signout-dialog"
        onConfirm={async () => { setConfirm(false); await signOut(); toast(t('profile.signedOut')); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 32, gap: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginVertical: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.navy900, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.white, fontSize: 20, fontWeight: '800' },
  flex: { flex: 1 },
  ver: { marginTop: 16, textAlign: 'center', fontWeight: '400' },
});
