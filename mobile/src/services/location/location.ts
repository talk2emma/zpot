import Geolocation, { type GeolocationError } from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import type { LocationStatus } from '../../store/prefsStore';
import type { LatLng } from '../../types/api';

Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse', locationProvider: 'auto' });

/** Requests foreground ("while using") location only. Never blocks guest use when declined. */
export async function requestLocationPermission(): Promise<LocationStatus> {
  if (Platform.OS === 'android') {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const fine = res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const coarse = res[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
    if (fine === 'granted') return probeServices('precise');
    if (coarse === 'granted') return probeServices('approx');
    return 'denied';
  }
  return new Promise(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(probeServices('precise')),
      (err: GeolocationError) => resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
    );
  });
}

async function probeServices(granted: 'precise' | 'approx'): Promise<LocationStatus> {
  try {
    await getCurrentPosition(8000);
    return granted;
  } catch (e) {
    const code = (e as GeolocationError).code;
    if (code === 2) return Platform.OS === 'android' ? 'off' : 'unavailable';
    if (code === 1) return 'denied';
    return granted; // timeout: permission is granted; position will arrive later
  }
}

export function getCurrentPosition(timeout = 10000): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    );
  });
}

export const hasLocation = (s: LocationStatus) => s === 'precise' || s === 'approx';
