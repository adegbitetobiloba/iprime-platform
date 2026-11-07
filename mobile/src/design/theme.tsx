// Owner: Account 1. Theme (light/dark/system) and text size, remembered on the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, radius, spacing, textScales, type TextSize, type ThemeColors } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  textSize: TextSize;
  textScale: number;
  spacing: typeof spacing;
  radius: typeof radius;
  setMode: (m: ThemeMode) => void;
  setTextSize: (s: TextSize) => void;
}

const KEY = 'iprime.prefs.v1';
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [textSize, setTextSizeState] = useState<TextSize>('default');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as { mode?: ThemeMode; textSize?: TextSize };
        if (p.mode === 'system' || p.mode === 'light' || p.mode === 'dark') setModeState(p.mode);
        if (p.textSize && p.textSize in textScales) setTextSizeState(p.textSize);
      })
      .catch(() => undefined); // preferences are a convenience; never block the app
  }, []);

  const save = useCallback((next: { mode: ThemeMode; textSize: TextSize }) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);
  const setMode = useCallback((m: ThemeMode) => { setModeState(m); save({ mode: m, textSize }); }, [save, textSize]);
  const setTextSize = useCallback((s: TextSize) => { setTextSizeState(s); save({ mode, textSize: s }); }, [save, mode]);

  const value = useMemo<Theme>(() => {
    const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
    return {
      colors: isDark ? darkColors : lightColors, isDark, mode, textSize, textScale: textScales[textSize],
      spacing, radius, setMode, setTextSize,
    };
  }, [mode, system, textSize, setMode, setTextSize]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider> (see src/core/providers.tsx)');
  return t;
}
