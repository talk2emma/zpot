import React, { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Icon, Screen, ScreenHeader } from '../../components/common';
import type { RootScreenProps } from '../../navigation/types';
import { availableApps, type NavApp, openNavigation } from '../../services/maps/navigationHandoff';
import { useSearchStore } from '../../store/searchStore';
import { radius, typography, useTheme } from '../../theme';

const APPS: { key: NavApp; init: string; bg: string }[] = [
  { key: 'apple', init: 'A', bg: '#2D7FF9' }, { key: 'google', init: 'G', bg: '#1E8E3E' },
  { key: 'waze', init: 'W', bg: '#33CCFF' }, { key: 'system', init: 'S', bg: '#4A6478' },
];

/** External navigation hand-off. The selected parking location is persisted so it is restored on return. */
export function NavigationPickerScreen({ navigation, route }: RootScreenProps<'NavigationPicker'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id, name, latitude, longitude } = route.params;
  const target = { latitude, longitude, label: name };
  const [installed, setInstalled] = useState<Record<NavApp, boolean> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const setHandoff = useSearchStore(s => s.setHandoff);
  const select = useSearchStore(s => s.select);

  useEffect(() => { void availableApps(target).then(setInstalled); }, [latitude, longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (app: NavApp) => {
    setErr(null);
    if (app === 'waze' && installed && !installed.waze) { setErr(t('nav.wazeMissing')); return; }
    select(id);
    setHandoff({ areaId: id, app, at: new Date().toISOString() });
    const ok = await openNavigation(app, target);
    if (!ok) { setHandoff(null); setErr(t('nav.openFailed', { app: t(`nav.${app}`) })); return; }
    // When the user comes back to Zpot, show the "Welcome back" outcome screen.
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') { sub.remove(); navigation.replace('NavigationReturn'); }
    });
  };

  const apps = APPS.filter(a => a.key !== 'apple' || Platform.OS === 'ios');
  return (
    <Screen testID="nav-picker-screen" header={<ScreenHeader title={t('nav.title')} onBack={navigation.goBack} backLabel={t('common.back')} />}>
      <View style={[styles.dest, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t('nav.sent')}</Text>
        <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 16 }]}>{name}</Text>
        <Text style={[typography.meta, { color: colors.textMuted }]}>{`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</Text>
      </View>
      {apps.map(a => {
        const sub = a.key === 'system' ? t('nav.askEvery') : installed === null ? '…' : installed[a.key] ? t('nav.installed')
          : a.key === 'google' ? t('nav.askEvery') : t('nav.notInstalled');
        return (
          <Pressable key={a.key} onPress={() => void go(a.key)} accessibilityRole="button" accessibilityLabel={`${t(`nav.${a.key}`)}, ${sub}`}
            style={[styles.app, { borderColor: colors.border }]} testID={`nav-app-${a.key}`}>
            <View style={[styles.init, { backgroundColor: a.bg }]}><Text style={styles.initText}>{a.init}</Text></View>
            <View style={styles.flex}>
              <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 16 }]}>{t(`nav.${a.key}`)}</Text>
              <Text style={[typography.meta, { color: colors.textMuted }]}>{sub}</Text>
            </View>
            <Icon name="chevronRight" color={colors.text} />
          </Pressable>
        );
      })}
      {err ? <Banner tone="error" testID="nav-error">{err}</Banner> : null}
      <Banner tone="info" icon="shield">{t('nav.safety')}</Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dest: { padding: 14, borderRadius: radius.lg, gap: 2 },
  app: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  init: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  initText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
