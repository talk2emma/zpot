import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../components/common';
import { ExploreScreen } from '../screens/explore/ExploreScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ActivityScreen, SavedScreen } from '../screens/profile/TabScreens';
import { palette, useTheme } from '../theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const ICON: Record<keyof TabParamList, IconName> = { Explore: 'compass', Saved: 'bookmark', Activity: 'clock', Profile: 'user' };

export function TabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.text,
      tabBarInactiveTintColor: palette.slate500,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      tabBarIcon: ({ focused }) => <Icon name={ICON[route.name]} color={focused ? palette.green700 : palette.slate500} size={22} />,
      tabBarButtonTestID: `tab-${route.name.toLowerCase()}`,
    })}>
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: t('tabs.explore') }} />
      <Tab.Screen name="Saved" component={SavedScreen} options={{ title: t('tabs.saved') }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ title: t('tabs.activity') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}
