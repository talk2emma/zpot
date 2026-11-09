import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language, VehicleClass } from '../types/api';
import { asyncJSONStorage } from './persist';

export type LocationStatus = 'unknown' | 'precise' | 'approx' | 'denied' | 'restricted' | 'off' | 'unavailable' | 'skipped';

export interface RecentPlace { id: string; name: string; subtitle: string; latitude: number; longitude: number }

export interface ParkingPrefs {
  maxWalk: number;
  freeOnlyDefault: boolean;
  offerPaidAlternatives: boolean;
  permitType: string | null;
  hasDisabledBadge: boolean;
  vehicleClass: VehicleClass;
}

interface PrefsState {
  hydrated: boolean;
  language: Language | null;
  onboardingDone: boolean;
  locationStatus: LocationStatus;
  recents: RecentPlace[];
  parking: ParkingPrefs;
  setLanguage(l: Language): void;
  completeOnboarding(): void;
  setLocationStatus(s: LocationStatus): void;
  addRecent(p: RecentPlace): void;
  clearRecents(): void;
  setParking(p: Partial<ParkingPrefs>): void;
  resetDeviceData(): void;
}

export const DEFAULT_PARKING_PREFS: ParkingPrefs = {
  maxWalk: 10, freeOnlyDefault: false, offerPaidAlternatives: true, permitType: null, hasDisabledBadge: false,
  vehicleClass: 'car',
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    set => ({
      hydrated: false,
      language: null,
      onboardingDone: false,
      locationStatus: 'unknown',
      recents: [],
      parking: DEFAULT_PARKING_PREFS,
      setLanguage: language => set({ language }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setLocationStatus: locationStatus => set({ locationStatus }),
      addRecent: p => set(s => ({ recents: [p, ...s.recents.filter(r => r.id !== p.id)].slice(0, 5) })),
      clearRecents: () => set({ recents: [] }),
      setParking: p => set(s => ({ parking: { ...s.parking, ...p } })),
      resetDeviceData: () => set({ onboardingDone: true, recents: [], parking: DEFAULT_PARKING_PREFS }),
    }),
    {
      name: 'zpot.prefs.v1',
      storage: asyncJSONStorage,
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => () => usePrefsStore.setState({ hydrated: true }),
    },
  ),
);
