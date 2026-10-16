import type { AccentColor } from '../contexts/themeOptions';

export type ThemeMode = 'light' | 'dark';

function readStoredValue(key: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        console.warn('Could not read local appearance preference:', error);
        return null;
    }
}

function writeStoredValue(key: string, value: string): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        console.warn('Could not save local appearance preference:', error);
    }
}

export function getLocalThemeMode(): ThemeMode | null {
    const themeMode = readStoredValue('themeMode');
    if (themeMode === 'light' || themeMode === 'dark') return themeMode;

    const darkMode = readStoredValue('darkMode');
    if (darkMode === 'true') return 'dark';
    if (darkMode === 'false') return 'light';
    return null;
}

export function setLocalThemeMode(themeMode: ThemeMode): void {
    writeStoredValue('themeMode', themeMode);
}

export function getLocalAccentColor(): AccentColor | null {
    const accentColor = readStoredValue('accentColor');
    if (accentColor === 'amber') return 'sage';
    if (accentColor === 'teal' || accentColor === 'coral'
        || accentColor === 'sage' || accentColor === 'violet') {
        return accentColor;
    }
    return null;
}

export function setLocalAccentColor(accentColor: AccentColor): void {
    writeStoredValue('accentColor', accentColor);
}
