import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Banner, EmptyState, ListRow, SectionLabel, Title } from '../../components/common';
import { usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { typography, useTheme } from '../../theme';

function TabPage({ title, children, testID }: { title: string; children: React.ReactNode; testID: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]} testID={testID}>
      <Title size="h1">{title}</Title>
      {children}
    </ScrollView>
  );
}

export function SavedScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const recents = usePrefsStore(s => s.recents);
  const setDestination = useSearchStore(s => s.setDestination);
  return (
    <TabPage title={t('tabs.saved')} testID="saved-screen">
      <Banner tone="info">{t('part2.saved')}</Banner>
      <SectionLabel>{t('search.recent')}</SectionLabel>
      {recents.length === 0 ? <EmptyState icon="clock" title={t('search.recent')} body={t('explore.noAreaBody')} /> : null}
      {recents.map(r => (
        <ListRow key={r.id} icon="clock" label={r.name} sub={r.subtitle} testID={`saved-recent-${r.id}`}
          onPress={() => { setDestination(r); navigation.navigate('Main', { screen: 'Explore' }); }} />
      ))}
    </TabPage>
  );
}

export function ActivityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  return (
    <TabPage title={t('tabs.activity')} testID="activity-screen">
      <View style={[styles.box, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('part2.title')}</Text>
        <Text style={[typography.meta, { color: colors.textBody }]}>{t('part2.activity')}</Text>
      </View>
      <ListRow icon="bell" label={t('profile.notifications')} onPress={() => navigation.navigate('NotificationsIntro')} testID="activity-notifs" />
    </TabPage>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  box: { padding: 14, borderRadius: 14, gap: 4 },
});
