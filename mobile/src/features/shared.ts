import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { type Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useAuthStore } from '../store/authStore';
import type { DraftPhoto } from '../store/reportDraftStore';

export function fmtDur(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${m} min`;
}

/** Runs `go` when signed in; otherwise remembers the destination and opens Sign in (journey preserved). */
export function useRequireAuth() {
  const navigation = useNavigation();
  return useCallback((route: string, params?: Record<string, unknown>, go?: () => void) => {
    const st = useAuthStore.getState();
    if (st.status === 'authenticated') {
      if (go) go(); else (navigation.navigate as unknown as (r: string, p?: object) => void)(route, params);
      return true;
    }
    st.setPendingReturn({ route, params });
    navigation.navigate('SignIn', { context: route });
    return false;
  }, [navigation]);
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export type PickResult = { photo: DraftPhoto } | { error: 'cancelled' | 'too_big' | 'type' | 'failed' };

/** Camera / library picker. Re-encodes to JPEG (quality 0.8) and requests no extra metadata. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const opts = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 2048, maxHeight: 2048, includeExtra: false,
    assetRepresentationMode: 'compatible' as const, saveToPhotos: false };
  try {
    const res = source === 'camera' ? await launchCamera(opts) : await launchImageLibrary({ ...opts, selectionLimit: 1 });
    if (res.didCancel) return { error: 'cancelled' };
    if (res.errorCode) return { error: 'failed' };
    const a: Asset | undefined = res.assets?.[0];
    if (!a?.uri) return { error: 'failed' };
    if (a.fileSize && a.fileSize > MAX_PHOTO_BYTES) return { error: 'too_big' };
    const type = (a.type || 'image/jpeg').toLowerCase();
    if (!OK_TYPES.includes(type)) return { error: 'type' };
    return { photo: { uri: a.uri, type,
      name: a.fileName || `photo-${Date.now()}.jpg`, fileSize: a.fileSize } };
  } catch {
    return { error: 'failed' };
  }
}
