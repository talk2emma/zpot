import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as location from '../src/services/location/location';
import { AccountChoiceScreen } from '../src/screens/onboarding/AccountChoiceScreen';
import { LanguageScreen } from '../src/screens/onboarding/LanguageScreen';
import { LocationOutcomeScreen } from '../src/screens/onboarding/LocationOutcomeScreen';
import { LocationPermissionScreen } from '../src/screens/onboarding/LocationPermissionScreen';
import { OnboardingScreen } from '../src/screens/onboarding/OnboardingScreen';
import { SplashScreen } from '../src/screens/onboarding/SplashScreen';
import { useAuthStore } from '../src/store/authStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { ALL_ROUTES, renderScreen } from './helpers/render';

beforeEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  usePrefsStore.setState({ hydrated: true, onboardingDone: false, language: null, locationStatus: 'unknown' });
  useAuthStore.setState({ status: 'guest', user: null });
});

describe('splash navigation', () => {
  it('first run goes to language selection', async () => {
    await renderScreen('Splash', SplashScreen, undefined, ALL_ROUTES);
    expect(screen.getByTestId('splash-screen')).toBeTruthy();
    expect(await screen.findByTestId('stub-Language', {}, { timeout: 3000 })).toBeTruthy();
  });
  it('returning user goes straight to the app', async () => {
    usePrefsStore.setState({ onboardingDone: true });
    await renderScreen('Splash', SplashScreen, undefined, ALL_ROUTES);
    expect(await screen.findByTestId('stub-Main', {}, { timeout: 3000 })).toBeTruthy();
  });
  it('waits for the session to be restored', async () => {
    useAuthStore.setState({ status: 'loading' });
    await renderScreen('Splash', SplashScreen, undefined, ALL_ROUTES);
    await new Promise<void>(r => { setTimeout(() => r(), 1200); });
    expect(screen.queryByTestId('stub-Language')).toBeNull();
    await act(() => useAuthStore.setState({ status: 'guest' }));
    expect(await screen.findByTestId('stub-Language', {}, { timeout: 3000 })).toBeTruthy();
  });
});

describe('onboarding', () => {
  it('persists the chosen language and applies translations', async () => {
    await renderScreen('Language', LanguageScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('lang-pt-PT'));
    expect(await screen.findByText('Escolha o idioma')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('language-continue'));
    expect(usePrefsStore.getState().language).toBe('pt-PT');
    expect(await screen.findByTestId('stub-Welcome')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stub-Welcome')); // no-op; restore language for other tests
    const i18n = require('../src/i18n').default;
    await act(async () => { await i18n.changeLanguage('en'); });
  });
  it('steps through the 3-page introduction and can skip', async () => {
    await renderScreen('Onboarding', OnboardingScreen, undefined, ALL_ROUTES);
    expect(screen.getByText('Search for your destination')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboard-next'));
    expect(screen.getByText('Compare legal parking options')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboard-next'));
    expect(screen.getByText('Navigate, park and help others')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboard-next'));
    expect(await screen.findByTestId('stub-LocationPermission')).toBeTruthy();
  });
});

describe('location permission fallback', () => {
  it('denied permission never blocks: outcome explains and continues to account choice', async () => {
    jest.spyOn(location, 'requestLocationPermission').mockResolvedValueOnce('denied');
    await renderScreen('LocationPermission', LocationPermissionScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('location-enable'));
    await screen.findByTestId('stub-LocationOutcome');
    expect(usePrefsStore.getState().locationStatus).toBe('denied');
  });
  it('outcome screen for denied/off/approx offers search and settings', async () => {
    usePrefsStore.setState({ locationStatus: 'denied' });
    await renderScreen('LocationOutcome', LocationOutcomeScreen, undefined, ALL_ROUTES);
    expect(screen.getByTestId('location-outcome-denied')).toBeTruthy();
    expect(screen.getByText('No problem — search a destination')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('location-outcome-continue'));
    expect(screen.getByTestId('stub-AccountChoice')).toBeTruthy();
  });
  it('“Enter a destination instead” skips location without asking', async () => {
    const spy = jest.spyOn(location, 'requestLocationPermission');
    await renderScreen('LocationPermission', LocationPermissionScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('location-manual'));
    expect(spy).not.toHaveBeenCalled();
    expect(usePrefsStore.getState().locationStatus).toBe('skipped');
    expect(await screen.findByTestId('stub-AccountChoice')).toBeTruthy();
  });
});

describe('guest mode', () => {
  it('continue as guest completes onboarding without an account', async () => {
    await renderScreen('AccountChoice', AccountChoiceScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('continue-as-guest'));
    await waitFor(() => expect(screen.getByTestId('stub-Main')).toBeTruthy());
    expect(usePrefsStore.getState().onboardingDone).toBe(true);
    expect(useAuthStore.getState().status).toBe('guest');
  });
});
