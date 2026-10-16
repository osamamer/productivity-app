import { useContext } from 'react';
import {
    PomodoroActionsContext,
    PomodoroContext,
    PomodoroPreferencesContext,
} from '../contexts/PomodoroContext';

export function usePomodoro() {
    const context = useContext(PomodoroContext);
    if (!context) throw new Error('usePomodoro must be used within a PomodoroProvider');
    return context;
}

export function usePomodoroActions() {
    const context = useContext(PomodoroActionsContext);
    if (!context) throw new Error('usePomodoroActions must be used within a PomodoroProvider');
    return context;
}

export function usePomodoroPreferences() {
    const context = useContext(PomodoroPreferencesContext);
    if (!context) throw new Error('usePomodoroPreferences must be used within a PomodoroProvider');
    return context;
}
