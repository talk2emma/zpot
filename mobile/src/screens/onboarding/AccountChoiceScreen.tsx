import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Logo, Screen, Title, ZpotButton } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { usePrefsStore } from '../../store/prefsStore';
import { radius, typography, useTheme } from '../../theme';

export function AccountChoiceScreen({ navigation }: RootScreenProps<'AccountChoice'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const complete = usePrefsStore(s => s.completeOnboarding);
  const guest = () => { complete(); navigation.reset({ index: 0, routes: [{ name: 'Main' }] }); };
  const auth = (route: 'SignIn' | 'Register') => { complete(); navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: route }] }); };
  return (
    <Screen testID="account-choice-screen" header={<View style={styles.pad} />}
      footer={<>
        <ZpotButton label={t('account.guest')} onPress={guest} testID="continue-as-guest" />
        <View style={styles.row}>
          <ZpotButton label={t('account.signIn')} variant="secondary" style={styles.flex} onPress={() => auth('SignIn')} testID="account-signin" />
          <ZpotButton label={t('account.create')} variant="secondary" style={styles.flex} onPress={() => auth('Register')} testID="account-register" />
        </View>
      </>}>
      <Logo variant="mark" height={80} />
      <Title>{t('account.title')}</Title>
      <Text style={[typography.body, { color: colors.textBody }]}>{t('account.body')}</Text>
      <View style={[styles.box, { backgroundColor: colors.surfaceMuted }]}>
        {[t('account.b1'), t('account.b2'), t('account.b3')].map(b => (
          <View key={b} style={styles.li}><Icon name="check" size={16} color={colors.accent} /><Text style={[typography.meta, { color: colors.textBody }]}>{b}</Text></View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { height: 40 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  box: { padding: 14, borderRadius: radius.lg, gap: 8 },
  li: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
