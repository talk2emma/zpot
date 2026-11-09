import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { usePrefsStore } from '../../store/prefsStore';
import { palette, typography, useTheme } from '../../theme';

const TONE: Record<string, [string, string]> = {
  precise: [palette.green50, palette.green900], approx: [palette.amber50, palette.amber900],
  unavailable: [palette.amber50, palette.amber900],
};

export function LocationOutcomeScreen({ navigation }: RootScreenProps<'LocationOutcome'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = usePrefsStore(s => s.locationStatus);
  const onboardingDone = usePrefsStore(s => s.onboardingDone);
  const key = ['precise', 'approx', 'denied', 'restricted', 'off', 'unavailable'].includes(status) ? status : 'denied';
  const [bg, fg] = TONE[key] ?? ['#EEF1F3', '#3D4C57'];
  const showSettings = ['approx', 'denied', 'off'].includes(key);
  const next = () => (onboardingDone ? navigation.popToTop() : navigation.navigate('AccountChoice'));
  return (
    <Screen testID="location-outcome-screen" header={<ScreenHeader onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton label={t('common.continue')} onPress={next} testID="location-outcome-continue" />}>
      <View style={[styles.icon, { backgroundColor: bg }]}><Icon name="crosshair" size={30} color={fg} /></View>
      <Text style={[typography.label, { color: colors.textMuted }]} testID={`location-outcome-${key}`}>{t(`location.${key}.tag`)}</Text>
      <Title>{t(`location.${key}.title`)}</Title>
      <Text style={[typography.body, { color: colors.textBody }]}>{t(`location.${key}.body`)}</Text>
      {showSettings ? <ZpotButton variant="small" label={t('location.openSettings')} onPress={() => void Linking.openSettings()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
