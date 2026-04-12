// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    darkMode: boolean;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
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
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('darkMode');
        if (saved !== null) {
            return JSON.parse(saved);
        }
        // Check system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    const toggleTheme = useCallback(() => {
        setDarkMode(prev => !prev);
    }, []);

    const setTheme = useCallback((mode: ThemeMode) => {
        setDarkMode(mode === 'dark');
    }, []);

    const theme = useMemo(() => {
        const { palette: basePalette } = createTheme();
        const { augmentColor } = basePalette;
        const createColor = (mainColor: string) => augmentColor({ color: { main: mainColor } });

        const t = createTheme({
            typography: {
                fontFamily: 'Raleway, Arial, sans-serif',
            },
            palette: darkMode ? {
                mode: 'dark',
                primary: {
                    main: '#A395F2',
                },
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
                primary: {
                    main: '#946AF5',
                },
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
    }, [darkMode]);

    const contextValue = useMemo(() => ({ darkMode, toggleTheme, setTheme }), [darkMode, toggleTheme, setTheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
