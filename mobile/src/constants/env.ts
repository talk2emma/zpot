import { Platform } from 'react-native';
import { GENERATED_ENV } from './env.generated';

const PLATFORM_DEFAULT_API = Platform.select({
  android: 'http://10.0.2.2:8000/api/v1', // Android emulator alias for the host machine
  ios: 'http://localhost:8000/api/v1', // iOS simulator shares the Mac network stack
  default: 'http://localhost:8000/api/v1',
});

const configured = Platform.OS === 'android' ? GENERATED_ENV.ZPOT_API_URL_ANDROID : GENERATED_ENV.ZPOT_API_URL_IOS;

// Only public tokens are usable on-device (gen-env.js also refuses sk.*). No token -> map reported unavailable.
const mapboxPublicToken = /^pk\./.test(GENERATED_ENV.ZPOT_MAPBOX_PUBLIC_TOKEN ?? '') ? GENERATED_ENV.ZPOT_MAPBOX_PUBLIC_TOKEN : '';

export const ENV = {
  apiBaseUrl: (configured || PLATFORM_DEFAULT_API).replace(/\/+$/, ''),
  mapStyleUrl: GENERATED_ENV.ZPOT_MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/streets-v12',
  mapboxPublicToken,
  mapboxConfigured: mapboxPublicToken.length > 0,
  requestTimeoutMs: Number(GENERATED_ENV.ZPOT_REQUEST_TIMEOUT_MS) || 12000,
  showDevTools: __DEV__ && GENERATED_ENV.ZPOT_SHOW_DEV_TOOLS !== 'false',
} as const;
