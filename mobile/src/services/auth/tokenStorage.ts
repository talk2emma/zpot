import * as Keychain from 'react-native-keychain';
import type { Tokens } from '../../types/api';

/** JWTs live only in the platform keychain/keystore. Passwords are never stored. */
const SERVICE = 'pt.zpot.app.auth';

export const tokenStorage = {
  async load(): Promise<Tokens | null> {
    try {
      const res = await Keychain.getGenericPassword({ service: SERVICE });
      if (!res) return null;
      const parsed = JSON.parse(res.password) as Tokens;
      return parsed.access && parsed.refresh ? parsed : null;
    } catch {
      return null;
    }
  },
  async save(tokens: Tokens): Promise<void> {
    await Keychain.setGenericPassword('zpot', JSON.stringify(tokens), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE });
  },
};
