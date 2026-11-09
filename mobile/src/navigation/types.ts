import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Explore: undefined;
  Saved: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type Part2Feature = 'session' | 'report' | 'save' | 'saved' | 'activity' | 'notifs';

export type RootStackParamList = {
  Splash: undefined;
  Language: { fromSettings?: boolean } | undefined;
  Welcome: undefined;
  Onboarding: undefined;
  LocationPermission: { fromSettings?: boolean } | undefined;
  LocationOutcome: undefined;
  AccountChoice: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Search: undefined;
  Plan: undefined;
  Filters: undefined;
  ParkingDetails: { id: number };
  NavigationPicker: { id: number; name: string; latitude: number; longitude: number };
  NavigationReturn: undefined;
  SignIn: { context?: string } | undefined;
  Register: { context?: string } | undefined;
  VerifyEmail: { token?: string; email?: string } | undefined;
  ForgotPassword: { token?: string } | undefined;
  Legal: { tab?: 'terms' | 'privacy' | 'sources' | 'disclaimer' } | undefined;
  AccountSettings: undefined;
  ParkingPreferences: undefined;
  Privacy: undefined;
  Help: undefined;
  DeleteAccount: undefined;
  NotificationsIntro: undefined;
  Part2: { feature: Part2Feature; areaId?: number };
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
