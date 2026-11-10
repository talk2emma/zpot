import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary, ToastHost } from '../components/common';
import '../i18n';
import { applyLanguage, deviceLanguage } from '../i18n';
import { useOnline } from '../hooks/useOnline';
import { ConsentHost } from '../components/privacy/ConsentHost';
import { linking } from '../navigation/linking';
import { navigationRef } from '../navigation/navigationRef';
import { RootNavigator } from '../navigation/RootNavigator';
import { queryClient } from '../services/queryClient';
import { useAuthStore } from '../store/authStore';
import { usePrefsStore } from '../store/prefsStore';
import { ThemeProvider, useTheme } from '../theme';


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
      <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
        <RootNavigator />
        <ConsentHost />
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
