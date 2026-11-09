import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { requestLocationPermission } from '../../services/location/location';
import { usePrefsStore } from '../../store/prefsStore';
import { palette, radius, typography, useTheme } from '../../theme';

export function LocationPermissionScreen({ navigation, route }: RootScreenProps<'LocationPermission'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const fromSettings = route.params?.fromSettings;
  const onboardingDone = usePrefsStore(s => s.onboardingDone);
  const setStatus = usePrefsStore(s => s.setLocationStatus);
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      const status = await requestLocationPermission();
      setStatus(status);
    } finally {
      setBusy(false);
    }
    navigation.navigate('LocationOutcome');
  };
  const manual = () => {
    if (!onboardingDone) { setStatus('skipped'); navigation.navigate('AccountChoice'); return; }
    navigation.navigate('Search');
  };
  const later = () => {
    if (!onboardingDone) { setStatus('skipped'); navigation.navigate('AccountChoice'); return; }
    navigation.goBack();
  };

  return (
    <Screen testID="location-permission-screen"
      header={fromSettings || onboardingDone ? <ScreenHeader onBack={navigation.goBack} backLabel={t('common.back')} /> : <View style={styles.pad} />}
      footer={<>
        <ZpotButton label={t('location.enable')} onPress={enable} loading={busy} testID="location-enable" />
        <ZpotButton label={t('location.enterDest')} variant="secondary" onPress={manual} testID="location-manual" />
        <ZpotButton label={t('common.notNow')} variant="tertiary" style={styles.center} onPress={later} testID="location-later" />
      </>}>
      <View style={[styles.icon, { backgroundColor: palette.green50 }]}><Icon name="crosshair" size={36} color={palette.green900} /></View>
      <Title size="title">{t('location.title')}</Title>
      <Text style={[typography.body, { color: colors.textBody }]}>{t('location.body')}</Text>
      <View style={[styles.box, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('location.use')}</Text>
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t('location.use2')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { height: 40 },
  icon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  box: { padding: 14, borderRadius: radius.lg, gap: 6 },
  center: { alignSelf: 'center' },
});
