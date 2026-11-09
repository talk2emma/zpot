import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Logo, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { applyLanguage, deviceLanguage } from '../../i18n';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import { radius, typography, useTheme } from '../../theme';
import type { Language } from '../../types/api';

export function LanguageScreen({ navigation, route }: RootScreenProps<'Language'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const fromSettings = route.params?.fromSettings;
  const stored = usePrefsStore(s => s.language);
  const setLanguage = usePrefsStore(s => s.setLanguage);
  const authed = useAuthStore(s => s.status === 'authenticated');
  const [choice, setChoice] = useState<Language>(stored ?? deviceLanguage());

  const pick = (l: Language) => { setChoice(l); applyLanguage(l); };
  const confirm = () => {
    setLanguage(choice);
    applyLanguage(choice);
    if (authed) void authApi.updatePreferences({ language: choice }).catch(() => undefined);
    if (fromSettings) navigation.goBack(); else navigation.navigate('Welcome');
  };

  const Option = ({ value, title }: { value: Language; title: string }) => {
    const on = choice === value;
    return (
      <Pressable onPress={() => pick(value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
        testID={`lang-${value}`} style={[styles.opt, { borderColor: on ? colors.text : colors.border }]}>
        <View style={styles.flex}>
          <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.meta, { color: colors.textMuted }]}>
            {value === 'en' ? 'Free during your selected hours' : 'Grátis durante o horário escolhido'}
          </Text>
        </View>
        {on ? <Icon name="check" color={colors.accent} /> : null}
      </Pressable>
    );
  };

  return (
    <Screen testID="language-screen"
      header={fromSettings ? <ScreenHeader title={t('profile.language')} onBack={navigation.goBack} backLabel={t('common.back')} /> : <View style={styles.pad} />}
      footer={<ZpotButton label={t('common.continue')} onPress={confirm} testID="language-continue" />}>
      {!fromSettings ? <Logo variant="wordmark" height={96} style={styles.logo} /> : null}
      <Title size="title">{t('language.title')}</Title>
      <Text style={[typography.body, { color: colors.textMuted }]}>{t('language.sub')}</Text>
      <Option value="en" title={t('language.en')} />
      <Option value="pt-PT" title={t('language.pt')} />
      <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[typography.label, { color: colors.textMuted }]}>{t('language.preview')}</Text>
        <ParkingStatusBadge category="free_time_limited" label={t('language.sample')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { height: 40 },
  flex: { flex: 1 },
  logo: { marginBottom: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.lg, borderWidth: 1.5 },
  preview: { padding: 14, borderRadius: radius.lg, gap: 8 },
});
