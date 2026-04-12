// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'light' | 'dark';
export type AccentColor = 'violet' | 'teal' | 'coral' | 'amber';

const THEME_MODE_STORAGE_KEY = 'themeMode';
const LEGACY_DARK_MODE_STORAGE_KEY = 'darkMode';
const ACCENT_COLOR_STORAGE_KEY = 'accentColor';

const accentPalettes: Record<AccentColor, {
    label: string;
    light: { main: string; light: string; dark: string; contrastText: string };
    dark: { main: string; light: string; dark: string; contrastText: string };
}> = {
    violet: {
        label: 'Violet',
        light: { main: '#946AF5', light: '#B7A0FA', dark: '#6F44D8', contrastText: '#FFFFFF' },
        dark: { main: '#A395F2', light: '#C6BCF7', dark: '#7A69D9', contrastText: '#111827' },
    },
    teal: {
        label: 'Teal',
        light: { main: '#0F9D8A', light: '#5BCBBE', dark: '#0A6F61', contrastText: '#FFFFFF' },
        dark: { main: '#52CDBD', light: '#8DE2D6', dark: '#289A8C', contrastText: '#0F172A' },
    },
    coral: {
        label: 'Coral',
        light: { main: '#E56B6F', light: '#F09CA0', dark: '#C44F53', contrastText: '#FFFFFF' },
        dark: { main: '#F08E84', light: '#F6B4AE', dark: '#D96A5F', contrastText: '#111827' },
    },
    amber: {
        label: 'Amber',
        light: { main: '#D18B00', light: '#E6B54D', dark: '#9E6700', contrastText: '#FFFFFF' },
        dark: { main: '#F1B93A', light: '#F6D27D', dark: '#D99912', contrastText: '#111827' },
    },
};

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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useAppTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useAppTheme must be used within a ThemeProvider');
    }
    return context;
};

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

        const t = createTheme({
            typography: {
                fontFamily: 'Raleway, Arial, sans-serif',
            },
            palette: darkMode ? {
                mode: 'dark',
                primary: primaryPalette,
                secondary: {
                    main: '#F5E55F',
                },
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
                secondary: {
                    main: '#F5E55F',
                },
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

export const accentColorOptions = Object.entries(accentPalettes).map(([value, config]) => ({
    value: value as AccentColor,
    label: config.label,
    swatch: config.light.main,
}));
