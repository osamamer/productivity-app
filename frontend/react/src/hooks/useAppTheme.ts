import {useContext} from 'react';
import {ThemeContext} from '../contexts/ThemeContext';

export function useAppTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useAppTheme must be used within a ThemeProvider');
    }
    return context;
}
