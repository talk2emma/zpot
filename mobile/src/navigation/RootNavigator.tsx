import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { FiltersScreen } from '../screens/explore/FiltersScreen';
import { PlanScreen } from '../screens/explore/PlanScreen';
import { SearchScreen } from '../screens/explore/SearchScreen';
import { AccountChoiceScreen } from '../screens/onboarding/AccountChoiceScreen';
import { LanguageScreen } from '../screens/onboarding/LanguageScreen';
import { LocationOutcomeScreen } from '../screens/onboarding/LocationOutcomeScreen';
import { LocationPermissionScreen } from '../screens/onboarding/LocationPermissionScreen';
import { NotificationsIntroScreen } from '../screens/onboarding/NotificationsIntroScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { NavigationPickerScreen } from '../screens/parking/NavigationPickerScreen';
import { NavigationReturnScreen } from '../screens/parking/NavigationReturnScreen';
import { ParkingDetailsScreen } from '../screens/parking/ParkingDetailsScreen';
import { AccountSettingsScreen, LegalScreen, ParkingPreferencesScreen } from '../screens/profile/SettingsScreens';
import {
  ContributionsScreen, NotificationDetailScreen, NotificationPrefsScreen, NotificationsScreen,
} from '../screens/account/AccountScreens';
import {
  MyReportsScreen, ReportDetailScreen, ReportDetailsScreen, ReportLocationScreen, ReportReviewScreen, ReportSuccessScreen, ReportTypeScreen,
} from '../screens/report/ReportScreens';
import {
  EditSessionScreen, EndSessionScreen, SessionHistoryScreen, SessionScreen, SessionSummaryScreen, StartSessionScreen,
} from '../screens/session/SessionScreens';
import {
  ContactSupportScreen, DeleteAccountScreen, HelpArticleScreen, HelpScreen, PrivacyRequestsScreen, PrivacyScreen, ProScreen,
  ScoutListScreen, ScoutTaskScreen, SupportTicketScreen, SupportTicketsScreen, ZEventScreen, ZTriggerScreen,
} from '../screens/support/SupportScreens';
import { CommuteScreen, InsightsScreen, ManageSubscriptionScreen, PartnerScreen, VehiclesScreen } from '../screens/planning/PlanningScreens';
import { Part2Screen } from '../screens/shared/Part2Screen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
      <Stack.Group>
        <Stack.Screen name="Language" component={LanguageScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
        <Stack.Screen name="LocationOutcome" component={LocationOutcomeScreen} />
        <Stack.Screen name="AccountChoice" component={AccountChoiceScreen} />
      </Stack.Group>
      <Stack.Screen name="Main" component={TabNavigator} options={{ animation: 'fade' }} />
      <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Plan" component={PlanScreen} />
        <Stack.Screen name="Filters" component={FiltersScreen} />
        <Stack.Screen name="NotificationsIntro" component={NotificationsIntroScreen} />
        <Stack.Screen name="Part2" component={Part2Screen} />
        <Stack.Screen name="StartSession" component={StartSessionScreen} />
        <Stack.Screen name="EndSession" component={EndSessionScreen} />
        <Stack.Screen name="ReportType" component={ReportTypeScreen} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
        <Stack.Screen name="ZEvent" component={ZEventScreen} />
        <Stack.Screen name="Partner" component={PartnerScreen} />
      </Stack.Group>
      <Stack.Screen name="Session" component={SessionScreen} />
      <Stack.Screen name="EditSession" component={EditSessionScreen} />
      <Stack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="SessionHistory" component={SessionHistoryScreen} />
      <Stack.Screen name="ReportLocation" component={ReportLocationScreen} />
      <Stack.Screen name="ReportDetails" component={ReportDetailsScreen} />
      <Stack.Screen name="ReportReview" component={ReportReviewScreen} />
      <Stack.Screen name="ReportSuccess" component={ReportSuccessScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="MyReports" component={MyReportsScreen} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
      <Stack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} />
      <Stack.Screen name="Contributions" component={ContributionsScreen} />
      <Stack.Screen name="HelpArticle" component={HelpArticleScreen} />
      <Stack.Screen name="SupportTickets" component={SupportTicketsScreen} />
      <Stack.Screen name="SupportTicket" component={SupportTicketScreen} />
      <Stack.Screen name="PrivacyRequests" component={PrivacyRequestsScreen} />
      <Stack.Screen name="ScoutList" component={ScoutListScreen} />
      <Stack.Screen name="ScoutTask" component={ScoutTaskScreen} />
      <Stack.Screen name="ZTrigger" component={ZTriggerScreen} />
      <Stack.Screen name="Pro" component={ProScreen} />
      <Stack.Screen name="Commute" component={CommuteScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} />
      <Stack.Screen name="Insights" component={InsightsScreen} />
      <Stack.Screen name="ManageSubscription" component={ManageSubscriptionScreen} />
      <Stack.Screen name="ParkingDetails" component={ParkingDetailsScreen} />
      <Stack.Screen name="NavigationPicker" component={NavigationPickerScreen} />
      <Stack.Screen name="NavigationReturn" component={NavigationReturnScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="ParkingPreferences" component={ParkingPreferencesScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </Stack.Navigator>
  );
}
