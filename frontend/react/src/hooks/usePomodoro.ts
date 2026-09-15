import { useContext } from 'react';
import { PomodoroContext } from '../contexts/PomodoroContext';

export function usePomodoro() {
    const context = useContext(PomodoroContext);
    if (!context) throw new Error('usePomodoro must be used within a PomodoroProvider');
    return context;
}
