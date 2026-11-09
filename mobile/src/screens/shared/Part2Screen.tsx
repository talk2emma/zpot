import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Screen, ScreenHeader, Title, ZpotButton } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { palette, typography, useTheme } from '../../theme';

/**
 * Honest destination for entry points whose modules are scheduled for Part 2 (sessions, reports, saving,
 * notifications). Routing and contracts exist; we never pretend the feature works.
 */
export function Part2Screen({ navigation, route }: RootScreenProps<'Part2'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { feature } = route.params;
  return (
    <Screen testID={`part2-${feature}`} header={<ScreenHeader onBack={navigation.goBack} close backLabel={t('common.close')} />}
      footer={<ZpotButton label={t('part2.backToResults')} onPress={navigation.goBack} testID="part2-back" />}>
      <View style={[styles.icon, { backgroundColor: palette.blue100 }]}><Icon name="info" size={30} color="#0B3A5C" /></View>
      <Title>{t('part2.title')}</Title>
      <Text style={[typography.body, { color: colors.textBody }]}>{t(`part2.${feature}`)}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' } });
