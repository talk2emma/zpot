import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** zpot://verify-email?token=…, zpot://reset-password?token=…, zpot://parking/42 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['zpot://'],
  config: {
    screens: {
      VerifyEmail: 'verify-email',
      ForgotPassword: 'reset-password',
      ParkingDetails: { path: 'parking/:id', parse: { id: Number } },
      Session: 'session/:id',
      ReportDetail: 'report/:id',
      Notifications: 'notifications',
      SupportTicket: 'support/:id',
      PrivacyRequests: 'privacy/requests',
      Main: { screens: { Explore: 'explore', Saved: 'saved', Activity: 'activity', Profile: 'profile' } },
    },
  },
};
