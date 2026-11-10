import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Banner, Icon, LoadingState, SectionLabel, ZpotSearchInput } from '../../components/common';
import { useAutocomplete, usePopularPlaces } from '../../hooks/useAutocomplete';
import { useOnline } from '../../hooks/useOnline';
import type { RootScreenProps } from '../../navigation/types';
import { getCurrentPosition, hasLocation } from '../../services/location/location';
import { type RecentPlace, usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { radius, typography, useTheme } from '../../theme';
import type { PlaceResult } from '../../types/api';

export function SearchScreen({ navigation }: RootScreenProps<'Search'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const { plan, filters, setDestination, origin, setOrigin } = useSearchStore();
  const { recents, addRecent, locationStatus } = usePrefsStore();
  const locOn = hasLocation(locationStatus);
  const ac = useAutocomplete(q, origin);
  const popular = usePopularPlaces();

  useEffect(() => { const id = setTimeout(() => input.current?.focus(), 250); return () => clearTimeout(id); }, []);

  const pick = (p: PlaceResult | RecentPlace) => {
    const cov = 'coverage' in p ? p.coverage : undefined;
    if (cov?.status === 'unsupported') { setMsg(t('search.unsupported', { place: p.name })); return; }
    if (!online) { setMsg(t('common.offline')); return; }
    const d = { id: p.id, name: p.name, subtitle: p.subtitle, latitude: p.latitude, longitude: p.longitude };
    addRecent(d);
    setDestination(d);
    navigation.goBack();
  };
  const useMyLocation = async () => {
    if (!locOn) { setMsg(t('search.locationOffMsg')); return; }
    try {
      const pos = await getCurrentPosition();
      setOrigin({ latitude: pos.latitude, longitude: pos.longitude });
      setDestination(null);
      navigation.goBack();
    } catch { setMsg(t('location.unavailable.body')); }
  };

  // A render function, not a component defined in render: rows would otherwise remount on every keystroke (M-18).
  const row = (key: string, p: PlaceResult | RecentPlace, icon: 'pin' | 'clock', testID: string) => (
    <Pressable key={key} onPress={() => pick(p)} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.subtitle}`}
      style={[styles.li, { borderBottomColor: colors.divider }]} testID={testID}>
      <Icon name={icon} color={colors.text} />
      <View style={styles.flex}>
        <Text style={[styles.name, { color: colors.text }]}>{p.name}</Text>
        {p.subtitle ? <Text style={[typography.meta, { color: colors.textMuted }]}>{p.subtitle}</Text> : null}
      </View>
    </Pressable>
  );

  const when = plan.useNow ? t('explore.now') : `${String(plan.hour).padStart(2, '0')}:00`;
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 6 }]} testID="search-screen">
      <View style={styles.bar}>
        <Pressable onPress={navigation.goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.ib} testID="search-back">
          <Icon name="chevronLeft" color={colors.text} />
        </Pressable>
        <ZpotSearchInput ref={input} value={q} onChangeText={v => { setQ(v); setMsg(null); }} placeholder={t('search.placeholder')}
          onClear={() => setQ('')} clearLabel={t('search.clear')} accessibilityLabel={t('search.placeholder')} testID="search-input"
          onSubmitEditing={() => ac.data?.[0] && pick(ac.data[0])} />
      </View>
      <View style={styles.body}>
        <Pressable onPress={() => navigation.navigate('Plan')} accessibilityRole="button" testID="search-plan"
          style={[styles.plan, { borderColor: colors.border }]}>
          <Icon name="clock" color={colors.text} />
          <View style={styles.flex}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('search.planTitle', { when, dur: plan.durationHours, walk: filters.maxWalk })}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{plan.useNow ? t('search.arrivingNow') : t('search.arriving', { when })}</Text>
          </View>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('common.change')}</Text>
        </Pressable>
        {msg ? <Banner tone="warn" testID="search-message">{msg}</Banner> : null}
        {!online ? <Banner tone="error" icon="offline">{t('common.offline')}</Banner> : null}
        <Pressable onPress={useMyLocation} accessibilityRole="button" style={[styles.li, { borderBottomColor: colors.divider }]} testID="search-my-location">
          <Icon name="navigation" color={colors.accent} />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]}>{t('search.useLocation')}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{locOn ? t('search.nearbySub') : t('search.locationOffSub')}</Text>
          </View>
        </Pressable>
        {q.trim() ? (
          <>
            <SectionLabel>{t('search.suggestions')}</SectionLabel>
            {ac.isFetching && !ac.data ? <LoadingState /> : null}
            {ac.error ? <Banner tone="error">{t('search.error')}</Banner> : null}
            {ac.data?.length === 0 ? <Text style={[typography.meta, { color: colors.textMuted }]} testID="search-none">{t('search.none', { q: q.trim() })}</Text> : null}
            {ac.data?.map(p => row(p.id, p, 'pin', `suggestion-${p.id}`))}
          </>
        ) : (
          <>
            {recents.length ? <SectionLabel>{t('search.recent')}</SectionLabel> : null}
            {recents.map(p => row(`r-${p.id}`, p, 'clock', `recent-${p.id}`))}
            <SectionLabel>{t('search.popular')}</SectionLabel>
            {popular.isLoading ? <LoadingState /> : null}
            {popular.data?.map(p => row(`p-${p.id}`, p, 'pin', `popular-${p.id}`))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  ib: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, gap: 8 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, borderWidth: 1 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: 1, paddingVertical: 6 },
  name: { fontSize: 16 },
  flex: { flex: 1 },
});
