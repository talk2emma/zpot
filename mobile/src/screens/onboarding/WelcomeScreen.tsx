import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName, Logo, Screen, ZpotButton } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { palette, typography, useTheme } from '../../theme';

export function WelcomeScreen({ navigation }: RootScreenProps<'Welcome'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rows: [IconName, string, string, string][] = [
    ['shield', t('welcome.v1'), t('welcome.v1b'), palette.green50],
    ['clock', t('welcome.v2'), t('welcome.v2b'), palette.blue100],
    ['bell', t('welcome.v3'), t('welcome.v3b'), palette.amber50],
  ];
  return (
    <Screen testID="welcome-screen" header={<View style={styles.pad} />}
      footer={<>
        <ZpotButton label={t('welcome.cta')} onPress={() => navigation.navigate('LocationPermission')} testID="welcome-find" />
        <ZpotButton label={t('welcome.how')} variant="tertiary" style={styles.center} onPress={() => navigation.navigate('Onboarding')} testID="welcome-how" />
      </>}>
      <View style={styles.hero}><Logo variant="full" height={160} /></View>
      <Text style={[typography.h1, styles.headline, { color: colors.text }]} accessibilityRole="header">{t('welcome.headline')}</Text>
      {rows.map(([icon, title, body, bg]) => (
        <View key={title} style={styles.row}>
          <View style={[styles.ic, { backgroundColor: bg }]}><Icon name={icon} color={palette.navy900} size={18} /></View>
          <View style={styles.flex}>
            <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 16 }]}>{title}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{body}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { height: 24 },
  hero: { alignItems: 'center' },
  headline: { textAlign: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ic: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
});
