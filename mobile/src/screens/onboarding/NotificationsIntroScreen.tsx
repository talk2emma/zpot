import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { palette, typography, useTheme } from '../../theme';

/** Contextual explanation only — the OS permission prompt is deferred to session start (StartSession primer). */
export function NotificationsIntroScreen({ navigation }: RootScreenProps<'NotificationsIntro'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen testID="notifications-intro-screen" header={<ScreenHeader onBack={navigation.goBack} close backLabel={t('common.close')} />}
      footer={<ZpotButton label={t('notifIntro.cta')} onPress={navigation.goBack} testID="notif-intro-ok" />}>
      <View style={[styles.icon, { backgroundColor: palette.amber50 }]}><Icon name="bell" size={30} color={palette.amber900} /></View>
      <Title>{t('notifIntro.title')}</Title>
      <Text style={[typography.body, { color: colors.textBody }]}>{t('notifIntro.body')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' } });
