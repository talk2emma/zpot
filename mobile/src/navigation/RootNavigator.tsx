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
import {
  AccountSettingsScreen,
  DeleteAccountScreen,
  HelpScreen,
  LegalScreen,
  ParkingPreferencesScreen,
  PrivacyScreen,
} from '../screens/profile/SettingsScreens';
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
      </Stack.Group>
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
