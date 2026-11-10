import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import i18n from '../src/i18n';
import { ConsentHost } from '../src/components/privacy/ConsentHost';
import { APP } from '../src/constants/app';
import { PrivacyPolicyScreen } from '../src/screens/legal/PrivacyPolicyScreen';
import { MyReportsScreen } from '../src/screens/report/ReportScreens';
import { PrivacyScreen } from '../src/screens/support/SupportScreens';
import { privacyApi, reportsApi, systemApi } from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';
import { hasConsent, useConsentStore } from '../src/store/consentStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { ALL_ROUTES, Providers, renderScreen } from './helpers/render';

const V = APP.privacyPolicyVersion;

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.spyOn(systemApi, 'config').mockRejectedValue(new Error('offline')); // bundled version is used
  useAuthStore.setState({ status: 'guest', user: null });
  usePrefsStore.setState({ hydrated: true, language: 'en' });
  useConsentStore.setState({ hydrated: true, decision: null, open: false, readingPolicy: false });
  await i18n.changeLanguage('en');
});

const host = () => render(<Providers><ConsentHost /></Providers>);

describe('consent prompt (GDPR / ePrivacy)', () => {
  it('asks on first use, with nothing pre-ticked, and Reject all records a refusal for this policy version', async () => {
    await host();
    expect(await screen.findByTestId('consent-sheet')).toBeTruthy();
    expect(screen.queryByTestId('consent-custom')).toBeNull(); // nothing pre-ticked on the first screen
    await fireEvent.press(screen.getByTestId('consent-reject-all'));
    const d = useConsentStore.getState().decision!;
    expect(d).toEqual(expect.objectContaining({ analytics: false, personalisedAds: false, marketing: false, version: V }));
    expect(hasConsent('analytics', V)).toBe(false);
    await waitFor(() => expect(screen.queryByTestId('consent-sheet')).toBeNull());
  });

  it('Accept all and Reject all have the same prominence', async () => {
    await host();
    const a = await screen.findByTestId('consent-accept-all');
    const r = screen.getByTestId('consent-reject-all');
    expect(JSON.stringify(a.props.style)).toEqual(JSON.stringify(r.props.style));
  });

  it('lets the user choose per purpose; optional purposes start off; essential cannot be switched off', async () => {
    await host();
    await fireEvent.press(await screen.findByTestId('consent-customise'));
    expect(screen.getByTestId('consent-analytics')).toHaveProp('accessibilityState', expect.objectContaining({ checked: false }));
    expect(screen.getByTestId('consent-essential')).toHaveProp('accessibilityState', expect.objectContaining({ checked: true, disabled: true }));
    await fireEvent.press(screen.getByTestId('consent-analytics'));
    await fireEvent.press(screen.getByTestId('consent-save'));
    expect(useConsentStore.getState().decision).toEqual(expect.objectContaining({ analytics: true, personalisedAds: false, marketing: false }));
  });

  it('asks again when the privacy policy version changes', async () => {
    useConsentStore.setState({ decision: { analytics: true, personalisedAds: true, marketing: true, version: 'old', decidedAt: '', synced: true } });
    await host();
    expect(await screen.findByTestId('consent-updated')).toBeTruthy();
    expect(hasConsent('analytics', V)).toBe(false); // an old-version "yes" is not consent to the new policy
  });

  it('does not ask before the language is chosen', async () => {
    usePrefsStore.setState({ language: null });
    await host();
    expect(screen.queryByTestId('consent-sheet')).toBeNull();
  });

  it('records signed-in choices in the server consent ledger (source consent_prompt)', async () => {
    const upd = jest.spyOn(privacyApi, 'updateConsents').mockResolvedValue({} as never);
    useAuthStore.setState({ status: 'authenticated', user: { id: '1', email: 'a@b.pt' } as never });
    await host();
    await fireEvent.press(await screen.findByTestId('consent-accept-all'));
    await waitFor(() => expect(upd).toHaveBeenCalledWith({ analytics: true, personalised_ads: true, marketing: true }, 'consent_prompt'));
    await waitFor(() => expect(useConsentStore.getState().decision?.synced).toBe(true));
  });
});

describe('privacy policy and choices', () => {
  it('shows the full Art. 13 notice with its version, in English and Portuguese', async () => {
    useConsentStore.setState({ decision: { analytics: false, personalisedAds: false, marketing: false, version: V, decidedAt: '', synced: true } });
    await renderScreen('PrivacyPolicy', PrivacyPolicyScreen, undefined, ALL_ROUTES);
    expect(screen.getByTestId('policy-version')).toHaveTextContent(new RegExp(V));
    expect(screen.getByText('9. Your rights')).toBeTruthy();
    expect(screen.getByText(/Comissão Nacional de Proteção de Dados/)).toBeTruthy();
    await act(() => i18n.changeLanguage('pt-PT'));
    expect(await screen.findByText('9. Os seus direitos')).toBeTruthy();
  });

  it('Privacy & permissions reopens the choices at any time', async () => {
    useConsentStore.setState({ decision: { analytics: true, personalisedAds: false, marketing: false, version: V, decidedAt: '', synced: true } });
    await renderScreen('Privacy', PrivacyScreen, undefined, ALL_ROUTES);
    expect(screen.getByTestId('privacy-choices')).toHaveTextContent(/Analytics: on/);
    await fireEvent.press(screen.getByTestId('privacy-choices'));
    expect(useConsentStore.getState().open).toBe(true);
  });
});

describe('pull to refresh', () => {
  it('re-fetches the screen data and stops the spinner when done', async () => {
    useAuthStore.setState({ status: 'authenticated', user: { id: '1', email: 'a@b.pt' } as never });
    const mine = jest.spyOn(reportsApi, 'mine').mockResolvedValue({ next: null, previous: null, results: [] });
    await renderScreen('MyReports', MyReportsScreen, undefined, ALL_ROUTES);
    await waitFor(() => expect(mine).toHaveBeenCalledTimes(1));
    // Jest's ScrollView mock doesn't mount refreshControl as a child; drive the same element through the prop.
    const control = () => screen.getByTestId('my-reports-screen-scroll').props.refreshControl;
    expect(control().props.testID).toBe('my-reports-screen-refresh');
    await act(async () => { control().props.onRefresh(); });
    await waitFor(() => expect(mine).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(control().props.refreshing).toBe(false));
  });
});
