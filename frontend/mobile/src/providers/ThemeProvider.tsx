import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'violet' | 'teal' | 'coral' | 'amber';

export interface AppColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  low: string;
  medium: string;
  high: string;
  overlay: string;
}

const accents: Record<AccentColor, { light: string; dark: string }> = {
  violet: { light: '#946AF5', dark: '#A395F2' },
  teal: { light: '#0F9D8A', dark: '#52CDBD' },
  coral: { light: '#E56B6F', dark: '#F08E84' },
  amber: { light: '#D18B00', dark: '#F1B93A' },
};

function palette(dark: boolean, accentColor: AccentColor): AppColors {
  const accent = dark ? accents[accentColor].dark : accents[accentColor].light;
  return dark
    ? {
        background: '#1E2124',
        surface: '#26292D',
        surfaceRaised: '#30343A',
        text: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.74)',
        border: 'rgba(255,255,255,0.09)',
        accent,
        accentSoft: `${accent}26`,
        onAccent: '#111827',
        success: '#4ADE80',
        warning: '#F5C451',
        danger: '#FF7A68',
        low: '#9FCAFA',
        medium: '#FAEC66',
        high: '#FF614B',
        overlay: 'rgba(0,0,0,0.62)',
      }
    : {
        background: '#F7F6FB',
        surface: '#FFFFFF',
        surfaceRaised: '#FFFFFF',
        text: '#1A1A2E',
        textMuted: 'rgba(26,26,46,0.72)',
        border: 'rgba(26,26,46,0.08)',
        accent,
        accentSoft: `${accent}18`,
        onAccent: '#FFFFFF',
        success: '#22C55E',
        warning: '#D18B00',
        danger: '#E35440',
        low: '#9FCAFA',
        medium: '#FAEC66',
        high: '#FF614B',
        overlay: 'rgba(17,24,39,0.42)',
      };
}

interface ThemeContextValue {
  colors: AppColors;
  dark: boolean;
  mode: ThemeMode;
  accent: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const MODE_KEY = 'mobile.theme.mode';
const ACCENT_KEY = 'mobile.theme.accent';

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<AccentColor>('violet');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName | null>(Appearance.getColorScheme() ?? null);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    void Promise.all([AsyncStorage.getItem(MODE_KEY), AsyncStorage.getItem(ACCENT_KEY)]).then(
      ([storedMode, storedAccent]) => {
        if (storedMode === 'system' || storedMode === 'light' || storedMode === 'dark') {
          setModeState(storedMode);
        }
        if (storedAccent && storedAccent in accents) setAccentState(storedAccent as AccentColor);
      },
    );
    return () => subscription.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(MODE_KEY, next);
  }, []);

  const setAccent = useCallback((next: AccentColor) => {
    setAccentState(next);
    void AsyncStorage.setItem(ACCENT_KEY, next);
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const value = useMemo(
    () => ({ colors: palette(dark, accent), dark, mode, accent, setMode, setAccent }),
    [accent, dark, mode, setAccent, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return value;
}

export const accentOptions = Object.entries(accents).map(([value, colors]) => ({
  value: value as AccentColor,
  color: colors.light,
  label: value[0].toUpperCase() + value.slice(1),
}));
