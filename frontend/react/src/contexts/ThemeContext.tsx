// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

    const toggleTheme = () => {
        setDarkMode(prev => !prev);
    };

    const setTheme = (mode: ThemeMode) => {
        setDarkMode(mode === 'dark');
    };

    // Helper to create custom colors
    const { palette: basePalette } = createTheme();
    const { augmentColor } = basePalette;
    const createColor = (mainColor: string) => augmentColor({ color: { main: mainColor } });

    // Create theme based on mode
    let theme = createTheme({
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
                paper: '#1e2124',
            },
            text: {
                primary: '#FFFFFF',
            },
        } : {
            mode: 'light',
            primary: {
                main: '#946AF5',
            },
            secondary: {
                main: '#F5E55F',
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
                default: '#ffffff',
                paper: '#f5f5f5',
            },
            text: {
                primary: '#000000',
            },
        },
    });

    // Apply responsive font sizes
    theme = responsiveFontSizes(theme);

    return (
        <ThemeContext.Provider value={{ darkMode, toggleTheme, setTheme }}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};