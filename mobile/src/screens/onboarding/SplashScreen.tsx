import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/common';
import { APP } from '../../constants/app';
import type { RootScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { usePrefsStore } from '../../store/prefsStore';
import { palette } from '../../theme';

/** JS splash: continues the native splash while preferences hydrate and the session is restored. */
export function SplashScreen({ navigation }: RootScreenProps<'Splash'>) {
  const { t } = useTranslation();
  const hydrated = usePrefsStore(s => s.hydrated);
  const onboardingDone = usePrefsStore(s => s.onboardingDone);
  const authStatus = useAuthStore(s => s.status);

  useEffect(() => { void BootSplash.hide({ fade: true }); }, []);

  useEffect(() => {
    if (!hydrated || authStatus === 'loading') return;
    const id = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: onboardingDone ? 'Main' : 'Language' }] });
    }, APP.splashMinMs);
    return () => clearTimeout(id);
  }, [hydrated, authStatus, onboardingDone, navigation]);

  return (
    <View style={styles.root} testID="splash-screen" accessibilityLabel="Zpot">
      <View style={styles.center}>
        <Logo variant="mark" height={150} />
        <View style={styles.bar}><View style={styles.barFill} /></View>
      </View>
      <Text style={styles.slogan}>{t('splash.slogan')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 36 },
  bar: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.green50, overflow: 'hidden' },
  barFill: { width: 22, height: 4, backgroundColor: palette.green500 },
  slogan: { fontSize: 15, color: palette.slate500 },
});
