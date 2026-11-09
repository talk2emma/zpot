import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Icon, Screen, ScreenHeader, Title, ZpotButton, ZpotTextField } from '../../components/common';
import { toast } from '../../components/common/Toast';
import { ENV } from '../../constants/env';
import { extractToken } from '../../features/auth/schemas';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { ApiError } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { palette, typography, useTheme } from '../../theme';

type State = 'pending' | 'verifying' | 'done' | 'expired' | 'invalid';

export function VerifyEmailScreen({ navigation, route }: RootScreenProps<'VerifyEmail'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [state, setState] = useState<State>(user?.is_email_verified ? 'done' : 'pending');
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef<string | null>(null);
  const email = route.params?.email ?? user?.email ?? '';

  const verify = async (raw: string) => {
    const token = extractToken(raw);
    if (!token) return;
    setState('verifying');
    try {
      const u = await authApi.verifyEmail(token);
      if (useAuthStore.getState().status === 'authenticated') setUser(u);
      setState('done');
    } catch (e) {
      setState(e instanceof ApiError && e.code === 'token_expired' ? 'expired' : 'invalid');
      setMsg(e instanceof ApiError ? e.message : null);
    }
  };

  useEffect(() => {
    const token = route.params?.token;
    if (token && handled.current !== token) { handled.current = token; void verify(token); }
  }, [route.params?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const resend = async () => {
    setBusy(true);
    try { await authApi.resendVerification(); toast(t('auth.resent')); setState('pending'); setMsg(null); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : t('errors.server')); }
    finally { setBusy(false); }
  };
  const checkNow = async () => {
    setBusy(true);
    try {
      const u = await authApi.me();
      setUser(u);
      if (u.is_email_verified) setState('done'); else setMsg(t('auth.notYet'));
    } catch (e) { setMsg(e instanceof ApiError ? e.message : t('errors.server')); }
    finally { setBusy(false); }
  };
  const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'));
  const done = state === 'done';

  return (
    <Screen testID="verify-email-screen" header={<ScreenHeader title={t('auth.verifyTitle')} onBack={leave} backLabel={t('common.back')} />}
      footer={done ? <ZpotButton label={t('common.continue')} onPress={leave} testID="verify-continue" /> : <>
        {user ? <ZpotButton label={t('auth.iVerified')} onPress={checkNow} loading={busy} testID="verify-check" /> : null}
        <ZpotButton variant="tertiary" style={{ alignSelf: 'center' }} label={t('auth.later')} onPress={leave} testID="verify-later" />
      </>}>
      <View style={[styles.icon, { backgroundColor: done ? palette.green50 : colors.surfaceMuted }]}>
        <Icon name={done ? 'check' : 'mail'} size={28} color={done ? palette.green900 : colors.text} />
      </View>
      {done ? (
        <>
          <Title size="h2">{t('auth.verified')}</Title>
          <Text style={[typography.body, { color: colors.textBody }]}>{t('auth.verifiedBody')}</Text>
        </>
      ) : (
        <>
          <Title size="h2">{t('auth.checkInbox')}</Title>
          {email ? <Text style={[typography.body, { color: colors.textBody }]}>{t('auth.verifySent', { email })}</Text> : null}
          {state === 'expired' ? <Banner tone="warn" testID="verify-expired">{t('auth.expired')}</Banner> : null}
          {state === 'invalid' && msg ? <Banner tone="error">{msg}</Banner> : null}
          {state === 'pending' && msg ? <Banner tone="info">{msg}</Banner> : null}
          {user ? <ZpotButton variant="small" label={t('auth.resend')} onPress={resend} disabled={busy} testID="verify-resend" /> : null}
          {ENV.showDevTools ? (
            <View style={[styles.dev, { backgroundColor: colors.surfaceMuted }]}>
              <ZpotTextField label={t('auth.pasteLink')} value={manual} onChangeText={setManual} autoCapitalize="none"
                autoCorrect={false} testID="verify-token-input" />
              <ZpotButton variant="small" label={t('auth.verifyToken')} onPress={() => verify(manual)} disabled={!manual || state === 'verifying'} testID="verify-token-submit" />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  dev: { padding: 14, borderRadius: 14, gap: 10 },
});
