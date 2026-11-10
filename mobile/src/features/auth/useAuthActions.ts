import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../components/common/Toast';
import { useAuthStore } from '../../store/authStore';
import type { AuthResponse } from '../../types/api';

/** After a successful sign-in/up, return the user to where they were (guest journey preserved). */
export function useFinishAuth() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  return useCallback(async (res: AuthResponse, opts: { verifyNext?: boolean } = {}) => {
    const store = useAuthStore.getState();
    await store.completeAuth(res);
    const ret = store.pendingReturn;
    store.setPendingReturn(null);
    if (opts.verifyNext) {
      store.setPendingReturn(ret); // keep the journey for after verification
      navigation.navigate('VerifyEmail', { email: res.user.email });
      return;
    }
    const imported = useAuthStore.getState().lastImport;
    if (imported) useAuthStore.setState({ lastImport: 0 });
    toast(imported ? t('saved.imported', { count: imported }) : t('auth.signedIn', { email: res.user.email }));
    if (ret) {
      (navigation.navigate as unknown as (r: string, p?: object) => void)(ret.route, ret.params);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation, t]);
}
