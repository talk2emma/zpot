import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Body, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import { usePrivacyVersion } from '../../hooks/useAccount';
import type { RootScreenProps } from '../../navigation/types';
import { useConsentStore } from '../../store/consentStore';
import { typography, useTheme } from '../../theme';

type Section = { h: string; p: string[] };

/** GDPR Art. 13 information notice (EN / PT-PT). Draft wording pending legal review is labelled as such. */
export function PrivacyPolicyScreen({ navigation }: RootScreenProps<'PrivacyPolicy'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const version = usePrivacyVersion();
  const sections = t('policy.sections', { returnObjects: true }) as unknown as Section[];
  // Opened from the consent prompt: show the prompt again when the user comes back.
  useEffect(() => () => useConsentStore.getState().setReadingPolicy(false), []);
  return (
    <Screen testID="privacy-policy-screen" header={<ScreenHeader title={t('policy.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}
      footer={<ZpotButton variant="secondary" label={t('consent.manage')} testID="policy-choices"
        onPress={() => { navigation.goBack(); useConsentStore.getState().setOpen(true); }} />}>
      <Title>{t('policy.title')}</Title>
      <Text style={[typography.meta, { color: colors.textMuted }]} testID="policy-version">{t('policy.meta', { v: version })}</Text>
      <Banner tone="warn" testID="policy-draft">{t('policy.draft')}</Banner>
      {Array.isArray(sections) ? sections.map(s => (
        <View key={s.h} style={styles.section}>
          <Text style={[typography.h2, { color: colors.text }]} accessibilityRole="header">{s.h}</Text>
          {s.p.map((para, i) => <Body key={i}>{para}</Body>)}
        </View>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: 8, marginTop: 8 } });
