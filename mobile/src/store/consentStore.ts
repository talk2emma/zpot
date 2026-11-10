import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncJSONStorage } from './persist';

/**
 * GDPR / ePrivacy consent for optional, non-essential processing (the mobile equivalent of a cookie banner).
 * Strictly necessary storage (sign-in tokens, preferences, install id) never needs consent and isn't listed here.
 * The record keeps the policy version and time so it can be shown to the server's consent ledger and re-asked
 * when the policy changes.
 */
export interface ConsentChoices { analytics: boolean; personalisedAds: boolean; marketing: boolean }
export interface ConsentDecision extends ConsentChoices { version: string; decidedAt: string; synced: boolean }

interface ConsentState {
  hydrated: boolean;
  decision: ConsentDecision | null;
  /** Manually reopened from Privacy & permissions. */
  open: boolean;
  /** Temporarily hidden while the full policy is being read. */
  readingPolicy: boolean;
  decide(choices: ConsentChoices, version: string): void;
  markSynced(): void;
  setOpen(open: boolean): void;
  setReadingPolicy(v: boolean): void;
}

export const REJECT_ALL: ConsentChoices = { analytics: false, personalisedAds: false, marketing: false };
export const ACCEPT_ALL: ConsentChoices = { analytics: true, personalisedAds: true, marketing: true };

export const useConsentStore = create<ConsentState>()(persist(set => ({
  hydrated: false,
  decision: null,
  open: false,
  readingPolicy: false,
  decide: (c, version) => set({ decision: { ...c, version, decidedAt: new Date().toISOString(), synced: false }, open: false }),
  markSynced: () => set(s => (s.decision ? { decision: { ...s.decision, synced: true } } : s)),
  setOpen: open => set({ open }),
  setReadingPolicy: readingPolicy => set({ readingPolicy }),
}), {
  name: 'zpot.consent.v1',
  storage: asyncJSONStorage,
  partialize: ({ decision }) => ({ decision }),
  onRehydrateStorage: () => () => useConsentStore.setState({ hydrated: true }),
}));

/** Optional processing may run only after an explicit "yes" for the current policy version. */
export function hasConsent(kind: keyof ConsentChoices, currentVersion: string) {
  const d = useConsentStore.getState().decision;
  return !!d && d.version === currentVersion && d[kind];
}
