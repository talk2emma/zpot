import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, errorMessage, Screen, ScreenHeader, ZpotButton, ZpotTextField } from '../../components/common';
import { ENV } from '../../constants/env';
import { emailSchema, extractToken, newPasswordSchema } from '../../features/auth/schemas';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { ApiError } from '../../services/api/errors';
import { typography, useTheme } from '../../theme';

type Stage = 'email' | 'sent' | 'newpw' | 'done';

export function ForgotPasswordScreen({ navigation, route }: RootScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [stage, setStage] = useState<Stage>(route.params?.token ? 'newpw' : 'email');
  const [token, setToken] = useState(route.params?.token ?? '');
  const [manual, setManual] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const emailForm = useForm<{ email: string }>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });
  const pwForm = useForm<{ password: string }>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '' } });

  useEffect(() => { if (route.params?.token) { setToken(route.params.token); setStage('newpw'); } }, [route.params?.token]);

  const send = emailForm.handleSubmit(async v => {
    setErr(null);
    try { await authApi.requestPasswordReset(v.email); setSentTo(v.email); setStage('sent'); }
    catch (e) { setErr(errorMessage(e, t)); }
  });
  const save = pwForm.handleSubmit(async v => {
    setErr(null);
    try { await authApi.confirmPasswordReset(token, v.password); setStage('done'); }
    catch (e) {
      const field = e instanceof ApiError ? e.fieldError('new_password') : undefined;
      if (field) pwForm.setError('password', { message: field }); else setErr(errorMessage(e, t));
    }
  });
  const m = (x?: string) => (x ? t(x, { defaultValue: x }) : undefined);

  return (
    <Screen testID="forgot-screen" header={<ScreenHeader title={t('auth.resetTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={stage === 'done' ? <ZpotButton label={t('auth.backToSignIn')} onPress={() => navigation.replace('SignIn')} testID="reset-back-signin" /> : undefined}>
      {stage === 'email' ? (
        <>
          <Text style={[typography.body, { color: colors.textBody }]}>{t('auth.resetIntro')}</Text>
          <Controller control={emailForm.control} name="email" render={({ field }) => (
            <ZpotTextField label={t('auth.email')} value={field.value} onChangeText={field.onChange} autoCapitalize="none"
              keyboardType="email-address" error={m(emailForm.formState.errors.email?.message)} testID="reset-email" />
          )} />
          <ZpotButton label={t('auth.sendReset')} onPress={send} loading={emailForm.formState.isSubmitting} testID="reset-send" />
        </>
      ) : null}
      {stage === 'sent' ? (
        <>
          <Banner tone="ok" testID="reset-sent">{t('auth.resetSent', { email: sentTo })}</Banner>
          {ENV.showDevTools ? (
            <View style={{ gap: 10 }}>
              <ZpotTextField label={t('auth.openedLink')} value={manual} onChangeText={setManual} autoCapitalize="none" testID="reset-token-input" />
              <ZpotButton variant="small" label={t('common.continue')} disabled={!manual}
                onPress={() => { setToken(extractToken(manual)); setStage('newpw'); }} testID="reset-token-submit" />
            </View>
          ) : null}
        </>
      ) : null}
      {stage === 'newpw' ? (
        <>
          <Controller control={pwForm.control} name="password" render={({ field }) => (
            <ZpotTextField label={t('auth.newPassword')} value={field.value} onChangeText={field.onChange} secureToggle
              autoComplete="new-password" hint={t('auth.pwHint')} error={m(pwForm.formState.errors.password?.message)} testID="reset-new-password" />
          )} />
          <ZpotButton label={t('auth.savePassword')} onPress={save} loading={pwForm.formState.isSubmitting} testID="reset-save" />
        </>
      ) : null}
      {stage === 'done' ? <Banner tone="ok" testID="reset-done">{t('auth.resetDone')}</Banner> : null}
      {err ? <Banner tone="error">{err}</Banner> : null}
    </Screen>
  );
}
