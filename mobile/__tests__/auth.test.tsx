import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { authApi } from '../src/services/api';
import { ApiError } from '../src/services/api/errors';
import { tokenStorage } from '../src/services/auth/tokenStorage';
import { RegisterScreen } from '../src/screens/auth/RegisterScreen';
import { SignInScreen } from '../src/screens/auth/SignInScreen';
import { VerifyEmailScreen } from '../src/screens/auth/VerifyEmailScreen';
import { useAuthStore } from '../src/store/authStore';
import type { AuthResponse } from '../src/types/api';
import { ALL_ROUTES, renderScreen } from './helpers/render';

const USER = { id: 'u1', email: 'rita@example.pt', display_name: 'Rita', is_email_verified: false, date_joined: '2026-11-09T10:00:00Z', roles: ['driver'] };
const RES: AuthResponse = { user: USER, tokens: { access: 'acc', refresh: 'ref' } };

beforeEach(() => { useAuthStore.setState({ status: 'guest', user: null, pendingReturn: null, sessionExpired: false }); jest.restoreAllMocks(); });

describe('sign in', () => {
  it('validates input before calling the API', async () => {
    const spy = jest.spyOn(authApi, 'login');
    await renderScreen('SignIn', SignInScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });
  it('shows the server error for wrong credentials', async () => {
    jest.spyOn(authApi, 'login').mockRejectedValue(new ApiError({ kind: 'http', status: 401, code: 'invalid_credentials', message: 'Email or password is incorrect.' }));
    await renderScreen('SignIn', SignInScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('signin-email'), 'rita@example.pt');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'nope-nope');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('signin-error')).toHaveTextContent('Email or password is incorrect.', { exact: false });
    expect(useAuthStore.getState().status).toBe('guest');
  });
  it('stores tokens securely and returns to the pending journey', async () => {
    jest.spyOn(authApi, 'login').mockResolvedValue(RES);
    const save = jest.spyOn(tokenStorage, 'save');
    useAuthStore.getState().setPendingReturn({ route: 'ParkingDetails', params: { id: 7 } });
    await renderScreen('SignIn', SignInScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('signin-email'), ' Rita@Example.pt ');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Str0ng-pass-123');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByTestId('stub-ParkingDetails')).toHaveTextContent('ParkingDetails:{"id":7}', { exact: false });
    expect(authApi.login).toHaveBeenCalledWith('rita@example.pt', 'Str0ng-pass-123');
    expect(save).toHaveBeenCalledWith({ access: 'acc', refresh: 'ref' });
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
  it('show/hide password toggles secure entry', async () => {
    await renderScreen('SignIn', SignInScreen, undefined, ALL_ROUTES);
    const input = screen.getByTestId('signin-password');
    expect(input.props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByTestId('signin-password-toggle'));
    expect(screen.getByTestId('signin-password').props.secureTextEntry).toBe(false);
  });
});

describe('register', () => {
  it('requires matching passwords and accepted terms', async () => {
    await renderScreen('Register', RegisterScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('register-email'), 'new@zpot.pt');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'Str0ng-pass-123');
    await fireEvent.changeText(screen.getByTestId('register-password2'), 'different-123');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('Passwords don’t match.')).toBeTruthy();
    expect(screen.getByText('Please accept the terms to continue.')).toBeTruthy();
  });
  it('maps the duplicate-email server error onto the email field', async () => {
    jest.spyOn(authApi, 'register').mockRejectedValue(new ApiError({ kind: 'http', status: 400, code: 'validation_error',
      message: 'Some fields are invalid.', fieldErrors: { email: ['An account with this email already exists.'] } }));
    await renderScreen('Register', RegisterScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('register-email'), 'dup@zpot.pt');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'Str0ng-pass-123');
    await fireEvent.changeText(screen.getByTestId('register-password2'), 'Str0ng-pass-123');
    await fireEvent.press(screen.getByTestId('register-terms'));
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
  });
  it('successful sign-up continues to email verification', async () => {
    jest.spyOn(authApi, 'register').mockResolvedValue(RES);
    await renderScreen('Register', RegisterScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('register-email'), 'rita@example.pt');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'Str0ng-pass-123');
    await fireEvent.changeText(screen.getByTestId('register-password2'), 'Str0ng-pass-123');
    await fireEvent.press(screen.getByTestId('register-terms'));
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('stub-VerifyEmail')).toBeTruthy();
    expect(authApi.register).toHaveBeenCalledWith(expect.objectContaining({ email: 'rita@example.pt', accept_terms: true }));
  });
});

describe('email verification', () => {
  it('verifies a token from a deep link', async () => {
    jest.spyOn(authApi, 'verifyEmail').mockResolvedValue({ ...USER, is_email_verified: true });
    await renderScreen('VerifyEmail', VerifyEmailScreen, { token: 'tok-123' }, ALL_ROUTES);
    expect(await screen.findByText('Email verified')).toBeTruthy();
    expect(authApi.verifyEmail).toHaveBeenCalledWith('tok-123');
  });
  it('after verifying, Continue resumes the journey instead of returning to the sign-up form', async () => {
    jest.spyOn(authApi, 'verifyEmail').mockResolvedValue({ ...USER, is_email_verified: true });
    useAuthStore.setState({ pendingReturn: { route: 'ParkingDetails', params: { id: 2 } } });
    await renderScreen('VerifyEmail', VerifyEmailScreen, { token: 'tok-123' }, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('verify-continue'));
    expect(await screen.findByTestId('stub-ParkingDetails')).toBeTruthy();
    expect(useAuthStore.getState().pendingReturn).toBeNull();
  });
  it('explains an expired link', async () => {
    jest.spyOn(authApi, 'verifyEmail').mockRejectedValue(new ApiError({ kind: 'http', status: 400, code: 'token_expired', message: 'expired' }));
    await renderScreen('VerifyEmail', VerifyEmailScreen, { token: 'old' }, ALL_ROUTES);
    await waitFor(() => expect(screen.getByTestId('verify-expired')).toBeTruthy());
  });
});
