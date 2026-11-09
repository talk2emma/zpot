import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Non-sensitive preferences only. Tokens live in the keychain (services/auth/tokenStorage). */
export const asyncJSONStorage = createJSONStorage(() => AsyncStorage);
