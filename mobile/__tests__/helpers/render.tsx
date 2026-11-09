import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../../src/i18n';
import { ThemeProvider } from '../../src/theme';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

export function Providers({ children }: { children: React.ReactNode }) {
  const qc = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }), []);
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <ThemeProvider forceScheme="light">{children}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
function Stub({ route }: { route: { name: string; params?: unknown } }) {
  return <Text testID={`stub-${route.name}`}>{`${route.name}:${JSON.stringify(route.params ?? {})}`}</Text>;
}

/** Renders one real screen inside a navigator; every other route is a stub that records its params. */
export async function renderScreen(name: string, Component: React.ComponentType<any>, params?: object, stubs: string[] = []) {
  return await render(
    <Providers>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }} initialRouteName={name}>
          <Stack.Screen name={name} component={Component} initialParams={params} />
          {stubs.filter(s => s !== name).map(s => <Stack.Screen key={s} name={s} component={Stub} />)}
        </Stack.Navigator>
      </NavigationContainer>
    </Providers>,
  );
}

export const ALL_ROUTES = ['Splash', 'Language', 'Welcome', 'Onboarding', 'LocationPermission', 'LocationOutcome', 'AccountChoice',
  'Main', 'Search', 'Plan', 'Filters', 'ParkingDetails', 'NavigationPicker', 'NavigationReturn', 'SignIn', 'Register',
  'VerifyEmail', 'ForgotPassword', 'Legal', 'AccountSettings', 'ParkingPreferences', 'Privacy', 'Help', 'DeleteAccount',
  'NotificationsIntro', 'Part2', 'StartSession', 'Session', 'EditSession', 'EndSession', 'SessionSummary', 'SessionHistory',
  'ReportType', 'ReportLocation', 'ReportDetails', 'ReportReview', 'ReportSuccess', 'MyReports', 'ReportDetail', 'Notifications',
  'NotificationDetail', 'NotificationPrefs', 'HelpArticle', 'ContactSupport', 'SupportTickets', 'SupportTicket', 'PrivacyRequests',
  'ScoutList', 'ScoutTask', 'ZTrigger', 'ZEvent', 'Pro', 'Contributions', 'Commute', 'Vehicles', 'Insights', 'Partner', 'ManageSubscription'];
