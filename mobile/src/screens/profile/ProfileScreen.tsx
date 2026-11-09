import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Banner, ConfirmDialog, ListRow, Title, ZpotButton } from '../../components/common';
import { toast } from '../../components/common/Toast';
import { ENV } from '../../constants/env';
import { systemApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import { palette, typography, useTheme } from '../../theme';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { status, user, signOut, sessionExpired } = useAuthStore();
  const language = usePrefsStore(s => s.language);
  const [confirm, setConfirm] = useState(false);
  const health = useQuery({ queryKey: ['health'], queryFn: systemApi.health, staleTime: 60_000, retry: 0 });
  const authed = status === 'authenticated' && user;
  const name = authed ? (user.display_name || user.email.split('@')[0]) : t('profile.guest');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]} testID="profile-screen">
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
      <ListRow icon="bell" label={t('profile.notifications')} onPress={() => navigation.navigate('NotificationsIntro')} testID="profile-notifs" />
      <ListRow icon="globe" label={t('profile.language')} value={language === 'pt-PT' ? 'Português' : 'English'}
        onPress={() => navigation.navigate('Language', { fromSettings: true })} testID="profile-language" />
      <ListRow icon="shield" label={t('profile.privacy')} onPress={() => navigation.navigate('Privacy')} testID="profile-privacy" />
      <ListRow icon="help" label={t('profile.help')} onPress={() => navigation.navigate('Help')} testID="profile-help" />
      <ListRow icon="file" label={t('profile.legal')} onPress={() => navigation.navigate('Legal')} testID="profile-legal" />
      {authed ? <ListRow icon="logout" label={t('profile.signOut')} onPress={() => setConfirm(true)} testID="profile-signout" /> : null}
      <Text style={[typography.small, styles.ver, { color: colors.textSubtle }]} testID="profile-version">
        {t('profile.version', { v: '0.1.0 (Part 1)', api: health.data ? health.data.version : health.isError ? 'unreachable' : '…' })}
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
