import React, { useEffect } from 'react';
import { usePrivacyVersion, useAuthed } from '../../hooks/useAccount';
import { navigationRef } from '../../navigation/navigationRef';
import { privacyApi } from '../../services/api';
import { useConsentStore } from '../../store/consentStore';
import { usePrefsStore } from '../../store/prefsStore';
import { ConsentSheet } from './ConsentSheet';

/**
 * Shows the consent prompt once the language is chosen (so it's in the user's language), again whenever the
 * privacy policy version changes, and on demand. Signed-in choices are written to the server consent ledger
 * (source "consent_prompt", stamped with the policy version server-side).
 */
export function ConsentHost() {
  const version = usePrivacyVersion();
  const authed = useAuthed();
  const prefsReady = usePrefsStore(s => s.hydrated && s.language !== null);
  const { hydrated, decision, open, readingPolicy } = useConsentStore();
  const needed = !decision || decision.version !== version;
  const visible = hydrated && prefsReady && !readingPolicy && (needed || open);

  useEffect(() => {
    if (!authed || !decision || decision.synced || decision.version !== version) return;
    privacyApi.updateConsents({ analytics: decision.analytics, personalised_ads: decision.personalisedAds,
      marketing: decision.marketing }, 'consent_prompt')
      .then(() => useConsentStore.getState().markSynced())
      .catch(() => undefined); // kept unsynced; retried on the next change of auth/decision or app start
  }, [authed, decision, version]);

  const readPolicy = () => {
    useConsentStore.getState().setReadingPolicy(true);
    if (navigationRef.isReady()) navigationRef.navigate('PrivacyPolicy');
  };
  return <ConsentSheet visible={visible} version={version} onReadPolicy={readPolicy} />;
}
