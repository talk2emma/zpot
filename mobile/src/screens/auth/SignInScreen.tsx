import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Banner, errorMessage, Screen, ScreenHeader, ZpotButton, ZpotTextField } from '../../components/common';
import { applyServerErrors } from '../../features/auth/applyServerErrors';
import { type SignInForm, signInSchema } from '../../features/auth/schemas';
import { useFinishAuth } from '../../features/auth/useAuthActions';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { ApiError } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';

export function SignInScreen({ navigation }: RootScreenProps<'SignIn'>) {
  const { t } = useTranslation();
  const finish = useFinishAuth();
  const expired = useAuthStore(s => s.sessionExpired);
  const [general, setGeneral] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<SignInForm>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async v => {
    setGeneral(null);
    try {
      await finish(await authApi.login(v.email, v.password));
    } catch (e) {
      const g = applyServerErrors(e, setError);
      setGeneral(g ?? (e instanceof ApiError && e.kind !== 'http' ? errorMessage(e, t) : null));
    }
  });

  return (
    <Screen testID="signin-screen" header={<ScreenHeader title={t('auth.signInTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<>
        <ZpotButton label={isSubmitting ? t('auth.signingIn') : t('auth.signIn')} loading={isSubmitting} onPress={onSubmit} testID="signin-submit" />
        <ZpotButton variant="tertiary" style={{ alignSelf: 'center' }} label={t('auth.newHere')} onPress={() => navigation.replace('Register')} testID="signin-to-register" />
      </>}>
      {expired ? <Banner tone="warn">{t('auth.sessionExpired')}</Banner> : null}
      <Controller control={control} name="email" render={({ field }) => (
        <ZpotTextField label={t('auth.email')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
          error={errors.email?.message && t(errors.email.message, { defaultValue: errors.email.message })} testID="signin-email" />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <ZpotTextField label={t('auth.password')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          secureToggle autoComplete="current-password" textContentType="password" onSubmitEditing={() => void onSubmit()}
          error={errors.password?.message && t(errors.password.message, { defaultValue: errors.password.message })} testID="signin-password" />
      )} />
      {general ? <Banner tone="error" testID="signin-error">{general}</Banner> : null}
      <ZpotButton variant="tertiary" label={t('auth.forgot')} onPress={() => navigation.navigate('ForgotPassword')} testID="signin-forgot" />
    </Screen>
  );
}
