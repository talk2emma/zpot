import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import i18n from 'i18next';
import { Icon, Logo, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { applyLanguage, deviceLanguage } from '../../i18n';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import { radius, typography, useTheme } from '../../theme';
import type { Language } from '../../types/api';

/** Illustrative walk time for the preview card — not a real result. */
const PREVIEW_WALK_MIN = 4;

/**
 * Language choice. Picking an option re-renders THIS screen (and its preview) in that language via a
 * fixed translator; the app-wide language only changes on Continue, so backing out leaves nothing half-applied.
 */
export function LanguageScreen({ navigation, route }: RootScreenProps<'Language'>) {
  const { colors } = useTheme();
  const fromSettings = route.params?.fromSettings;
  const stored = usePrefsStore(s => s.language);
  const setLanguage = usePrefsStore(s => s.setLanguage);
  const authed = useAuthStore(s => s.status === 'authenticated');
  const [choice, setChoice] = useState<Language>(stored ?? deviceLanguage());
  const t = useMemo(() => i18n.getFixedT(choice), [choice]);

  const confirm = () => {
    setLanguage(choice);
    applyLanguage(choice);
    if (authed) void authApi.updatePreferences({ language: choice }).catch(() => undefined);
    if (fromSettings) navigation.goBack(); else navigation.navigate('Welcome');
  };

  const Option = ({ value, title }: { value: Language; title: string }) => {
    const on = choice === value;
    return (
      <Pressable onPress={() => setChoice(value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
        accessibilityLanguage={value} testID={`lang-${value}`}
        style={[styles.opt, { borderColor: on ? colors.text : colors.border }]}>
        <Text style={[typography.h2, styles.flex, { color: colors.text }]}>{title}</Text>
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
      <View accessibilityRole="radiogroup" style={styles.options}>
        <Option value="en" title={t('language.en')} />
        <Option value="pt-PT" title={t('language.pt')} />
      </View>

      {/* What parking info will look like in the chosen language — real app strings, illustrative values. */}
      <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]} accessibilityLanguage={choice}
        testID="language-preview">
        <Text style={[typography.label, { color: colors.textMuted }]}>{t('language.preview')}</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ParkingStatusBadge category="free_time_limited" label={t('category.free_time_limited')} />
          <Text style={[typography.body, { color: colors.text }]} testID="language-preview-sample">{t('language.sample')}</Text>
          <View style={styles.row}>
            <Text style={[typography.meta, styles.flex, { color: colors.textMuted }]}>
              {t('common.minWalk', { count: PREVIEW_WALK_MIN })}
            </Text>
            <View style={[styles.navPill, { borderColor: colors.text }]} importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden>
              <Text style={[typography.badge, { color: colors.text }]}>{t('explore.navigate')}</Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { height: 40 },
  flex: { flex: 1 },
  logo: { marginBottom: 8 },
  options: { gap: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.lg, borderWidth: 1.5 },
  preview: { padding: 14, borderRadius: radius.lg, gap: 8 },
  card: { padding: 12, borderRadius: radius.md, borderWidth: 1, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navPill: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
});
