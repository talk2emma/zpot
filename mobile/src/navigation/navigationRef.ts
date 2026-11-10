import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** For UI that lives outside the navigator (e.g. the consent sheet) and still needs to open a screen. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
