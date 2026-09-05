// src/contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {accentPalettes, type AccentColor} from './themeOptions';

type ThemeMode = 'light' | 'dark';

const THEME_MODE_STORAGE_KEY = 'themeMode';
const LEGACY_DARK_MODE_STORAGE_KEY = 'darkMode';
const ACCENT_COLOR_STORAGE_KEY = 'accentColor';

interface ThemeContextType {
    darkMode: boolean;
    mode: ThemeMode;
    accentColor: AccentColor;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
    setAccentColor: (color: AccentColor) => void;
}

// Extend MUI theme to include custom palette colors
declare module '@mui/material/styles' {
    interface Palette {
        low: Palette['primary'];
        medium: Palette['primary'];
        high: Palette['primary'];
    }
    interface PaletteOptions {
        low?: PaletteOptions['primary'];
        medium?: PaletteOptions['primary'];
        high?: PaletteOptions['primary'];
    }
    interface PaletteColor {
        medium?: string;
        high?: string;
    }
    interface SimplePaletteColorOptions {
        medium?: string;
        high?: string;
    }
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const AppThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark') {
            return savedMode;
        }

        const legacyDarkMode = localStorage.getItem(LEGACY_DARK_MODE_STORAGE_KEY);
        if (legacyDarkMode !== null) {
            return JSON.parse(legacyDarkMode) ? 'dark' : 'light';
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });
    const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
        const savedAccentColor = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
        return savedAccentColor === 'teal' || savedAccentColor === 'coral' || savedAccentColor === 'amber' || savedAccentColor === 'violet'
            ? savedAccentColor
            : 'violet';
    });
    const darkMode = mode === 'dark';

    useEffect(() => {
        localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
        localStorage.setItem(LEGACY_DARK_MODE_STORAGE_KEY, JSON.stringify(darkMode));
    }, [darkMode, mode]);

    useEffect(() => {
        localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, accentColor);
    }, [accentColor]);

    const toggleTheme = useCallback(() => {
        setMode(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    const setTheme = useCallback((mode: ThemeMode) => {
        setMode(mode);
    }, []);

    const setAccentColor = useCallback((color: AccentColor) => {
        setAccentColorState(color);
    }, []);

    const theme = useMemo(() => {
        const { palette: basePalette } = createTheme();
        const { augmentColor } = basePalette;
        const createColor = (mainColor: string) => augmentColor({ color: { main: mainColor } });
        const primaryPalette = darkMode ? accentPalettes[accentColor].dark : accentPalettes[accentColor].light;
        const secondaryPalette = darkMode
            ? accentPalettes[accentColor].secondary.dark
            : accentPalettes[accentColor].secondary.light;

        const t = createTheme({
            typography: {
                fontFamily: 'Raleway, Arial, sans-serif',
            },
            palette: darkMode ? {
                mode: 'dark',
                primary: primaryPalette,
                secondary: secondaryPalette,
                success: {
                    main: '#22C55E',
                    light: '#4ADE80',
                    dark: '#16A34A',
                },
                info: {
                    main: '#9FCAFA',
                    medium: '#FAEC66',
                    high: '#FF614B',
                },
                low: createColor('#9FCAFA'),
                medium: createColor('#FAEC66'),
                high: createColor('#FF614B'),
                background: {
                    default: '#1e2124',
                    paper: '#26292d',
                },
                text: {
                    primary: '#FFFFFF',
                    secondary: 'rgba(255,255,255,0.6)',
                },
            } : {
                mode: 'light',
                primary: primaryPalette,
                secondary: secondaryPalette,
                success: {
                    main: '#22C55E',
                    light: '#4ADE80',
                    dark: '#16A34A',
                },
                info: {
                    main: '#9FCAFA',
                    medium: '#FAEC66',
                    high: '#FF614B',
                },
                low: createColor('#9FCAFA'),
                medium: createColor('#FAEC66'),
                high: createColor('#FF614B'),
                background: {
                    default: '#F7F6FB',
                    paper: '#FFFFFF',
                },
                text: {
                    primary: '#1A1A2E',
                    secondary: 'rgba(26,26,46,0.6)',
                },
            },
            components: {
                MuiCssBaseline: {
                    styleOverrides: {
                        '*': {
                            scrollbarWidth: 'thin',
                            scrollbarColor: `${darkMode ? 'rgba(255,255,255,0.34)' : 'rgba(26,26,46,0.24)'} transparent`,
                        },
                        '*::-webkit-scrollbar': {
                            width: 8,
                            height: 8,
                        },
                        '*::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                        },
                        '*::-webkit-scrollbar-thumb': {
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(26,26,46,0.2)',
                            border: `2px solid ${darkMode ? '#1e2124' : '#F7F6FB'}`,
                            borderRadius: 999,
                        },
                        '*::-webkit-scrollbar-thumb:hover': {
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.48)' : 'rgba(26,26,46,0.34)',
                        },
                    },
                },
                MuiDialog: {
                    styleOverrides: {
                        paper: {
                            backgroundImage: 'none',
                            backgroundColor: darkMode ? '#1e2124' : '#FFFFFF',
                            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,26,46,0.08)',
                        },
                    },
                },
                MuiPopover: {
                    styleOverrides: {
                        paper: {
                            backgroundImage: 'none',
                            backgroundColor: darkMode ? '#1e2124' : '#FFFFFF',
                            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,26,46,0.08)',
                        },
                    },
                },
                MuiMenu: {
                    styleOverrides: {
                        paper: {
                            backgroundImage: 'none',
                            backgroundColor: darkMode ? '#1e2124' : '#FFFFFF',
                            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,26,46,0.08)',
                        },
                    },
                },
            },
        });
        return responsiveFontSizes(t);
    }, [accentColor, darkMode]);

    const contextValue = useMemo(() => ({
        darkMode,
        mode,
        accentColor,
        toggleTheme,
        setTheme,
        setAccentColor,
    }), [accentColor, darkMode, mode, setAccentColor, setTheme, toggleTheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
