import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary, ToastHost } from '../components/common';
import '../i18n';
import { applyLanguage, deviceLanguage } from '../i18n';
import { useOnline } from '../hooks/useOnline';
import { linking } from '../navigation/linking';
import { RootNavigator } from '../navigation/RootNavigator';
import { ApiError } from '../services/api/errors';
import { useAuthStore } from '../store/authStore';
import { usePrefsStore } from '../store/prefsStore';
import { ThemeProvider, useTheme } from '../theme';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // the API client already retries idempotent GETs on network errors; don't multiply retries here
      retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && count < 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Shell() {
  const { scheme, colors } = useTheme();
  const language = usePrefsStore(s => s.language);
  const hydrated = usePrefsStore(s => s.hydrated);
  useOnline();
  useEffect(() => { void useAuthStore.getState().bootstrap(); }, []);
  useEffect(() => { if (hydrated) applyLanguage(language ?? deviceLanguage()); }, [hydrated, language]);
  const navTheme = { ...DefaultTheme, dark: scheme === 'dark',
    colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent } };
  return (
    <>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer linking={linking} theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider forceScheme="light">
          <ErrorBoundary onReset={() => queryClient.clear()}>
            <Shell />
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
