import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Screen, ScreenHeader, ZpotButton } from '../../components/common';
import { ParkingMapMarker } from '../../components/parking/ParkingMapMarker';
import type { RootScreenProps } from '../../navigation/types';
import { palette, radius, shadows, typography, useTheme } from '../../theme';

export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const steps = [[t('onboard.o1'), t('onboard.o1b')], [t('onboard.o2'), t('onboard.o2b')], [t('onboard.o3'), t('onboard.o3b')]];
  const next = () => (step < 2 ? setStep(step + 1) : navigation.navigate('LocationPermission'));
  const back = () => (step > 0 ? setStep(step - 1) : navigation.goBack());
  return (
    <Screen testID="onboarding-screen"
      header={<ScreenHeader onBack={back} backLabel={t('common.back')}
        right={<ZpotButton variant="tertiary" label={t('common.skip')} onPress={() => navigation.navigate('LocationPermission')} testID="onboard-skip" />} />}
      footer={<ZpotButton label={step < 2 ? t('common.next') : t('welcome.cta')} onPress={next} testID="onboard-next" />}>
      <View style={[styles.art, { backgroundColor: colors.surfaceMuted }]} accessibilityElementsHidden>
        {step === 0 ? (
          <View style={[styles.pill, shadows.card, { backgroundColor: colors.surface }]}>
            <Icon name="search" color={colors.text} /><Text style={[typography.bodyStrong, { color: colors.text }]}>{t('onboard.sampleSearch')}</Text>
          </View>
        ) : step === 1 ? (
          <View style={styles.markers}>
            <ParkingMapMarker category="free" label={t('category.free')} />
            <ParkingMapMarker category="free_time_limited" label="◆ 08:00" />
            <ParkingMapMarker category="paid" label="€1.60/h" />
            <ParkingMapMarker category="unknown" label="?" />
          </View>
        ) : (
          <View style={styles.markers}>
            <Icon name="navigation" size={48} color={palette.green700} />
            <Icon name="flag" size={40} color={palette.purple500} />
          </View>
        )}
      </View>
      <Text style={[typography.small, { color: colors.textMuted }]}>{t('onboard.step', { n: step + 1 })}</Text>
      <Text style={[typography.h1, { color: colors.text }]} accessibilityRole="header">{steps[step][0]}</Text>
      <Text style={[typography.body, { color: colors.textBody }]}>{steps[step][1]}</Text>
      <View style={styles.dots}>
        {[0, 1, 2].map(i => <View key={i} style={[styles.dot, { width: i === step ? 24 : 6, backgroundColor: i === step ? palette.green700 : palette.slate200 }]} />)}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { height: 260, borderRadius: radius.xxl, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 50, borderRadius: radius.lg, width: '85%' },
  markers: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', padding: 20 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dot: { height: 6, borderRadius: 3 },
});
