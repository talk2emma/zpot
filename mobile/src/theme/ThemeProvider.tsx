import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colorSchemes, type ColorScheme, type ThemeColors } from './tokens';

type Theme = { scheme: ColorScheme; colors: ThemeColors };
const ThemeContext = createContext<Theme>({ scheme: 'light', colors: colorSchemes.light });

export function ThemeProvider({ children, forceScheme }: { children: React.ReactNode; forceScheme?: ColorScheme }) {
  const system = useColorScheme();
  const scheme: ColorScheme = forceScheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => ({ scheme, colors: colorSchemes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
