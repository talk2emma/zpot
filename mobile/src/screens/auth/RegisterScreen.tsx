import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, errorMessage, Icon, Screen, ScreenHeader, ZpotButton, ZpotTextField } from '../../components/common';
import { applyServerErrors } from '../../features/auth/applyServerErrors';
import { type RegisterForm, registerSchema } from '../../features/auth/schemas';
import { useFinishAuth } from '../../features/auth/useAuthActions';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { ApiError } from '../../services/api/errors';
import { usePrefsStore } from '../../store/prefsStore';
import { palette, typography, useTheme } from '../../theme';

export function RegisterScreen({ navigation, route }: RootScreenProps<'Register'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const finish = useFinishAuth();
  const language = usePrefsStore(s => s.language) ?? 'en';
  const [general, setGeneral] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema), defaultValues: { email: '', password: '', password2: '', terms: false },
  });
  const msg = (m?: string) => (m ? t(m, { defaultValue: m }) : undefined);

  const onSubmit = handleSubmit(async v => {
    setGeneral(null);
    try {
      const res = await authApi.register({ email: v.email, password: v.password, accept_terms: v.terms, language });
      await finish(res, { verifyNext: true });
    } catch (e) {
      const g = applyServerErrors(e, setError, { accept_terms: 'terms' });
      setGeneral(g ?? (e instanceof ApiError && e.kind !== 'http' ? errorMessage(e, t) : null));
    }
  });

  return (
    <Screen testID="register-screen" header={<ScreenHeader title={t('auth.registerTitle')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<>
        <ZpotButton label={isSubmitting ? t('auth.creating') : t('auth.create')} loading={isSubmitting} onPress={onSubmit} testID="register-submit" />
        <ZpotButton variant="tertiary" style={{ alignSelf: 'center' }} label={t('auth.haveAccount')} onPress={() => navigation.replace('SignIn')} />
      </>}>
      {route.params?.context ? <Banner tone="info">{t('auth.ctxSave', { place: route.params.context })}</Banner> : null}
      <Controller control={control} name="email" render={({ field }) => (
        <ZpotTextField label={t('auth.email')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address"
          error={msg(errors.email?.message)} testID="register-email" />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <ZpotTextField label={t('auth.password')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          secureToggle autoComplete="new-password" textContentType="newPassword" hint={t('auth.pwHint')}
          error={msg(errors.password?.message)} testID="register-password" />
      )} />
      <Controller control={control} name="password2" render={({ field }) => (
        <ZpotTextField label={t('auth.confirmPassword')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          secureToggle autoComplete="new-password" error={msg(errors.password2?.message)} testID="register-password2" />
      )} />
      <Controller control={control} name="terms" render={({ field }) => (
        <View>
          <Pressable style={styles.terms} onPress={() => field.onChange(!field.value)} accessibilityRole="checkbox"
            accessibilityState={{ checked: field.value }} testID="register-terms">
            <View style={[styles.box, { borderColor: colors.borderStrong, backgroundColor: field.value ? palette.navy900 : colors.surface }]}>
              {field.value ? <Icon name="check" size={16} color={palette.white} /> : null}
            </View>
            <Text style={[typography.meta, styles.flex, { color: colors.textBody }]}>
              {t('auth.acceptPrefix')}
              <Text style={styles.link} onPress={() => navigation.navigate('Legal', { tab: 'terms' })}>{t('auth.terms')}</Text>
              {t('auth.acceptMid')}
              <Text style={styles.link} onPress={() => navigation.navigate('Legal', { tab: 'privacy' })}>{t('auth.privacy')}</Text>.
            </Text>
          </Pressable>
          {errors.terms ? <Text style={[styles.err, { color: colors.danger }]}>{msg(errors.terms.message)}</Text> : null}
        </View>
      )} />
      {general ? <Banner tone="error" testID="register-error">{general}</Banner> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  terms: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  flex: { flex: 1 },
  link: { textDecorationLine: 'underline', fontWeight: '600' },
  err: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
