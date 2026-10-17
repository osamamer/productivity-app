import { type Theme } from '@mui/material/styles';

type Tone = 'warning' | 'error' | 'primary' | 'secondary' | 'info' | 'success';

const stateTones: Record<string, Tone> = {
    'Wired/Tired': 'warning',
    Depleted: 'error',
    'Stimulation-Seeking': 'primary',
    'Scattered/Overactivated': 'error',
    'Emotionally Loaded': 'secondary',
    'Low Mood': 'info',
    Ready: 'success',
    'Almost Ready': 'warning',
    Engaged: 'primary',
    Mixed: 'secondary',
};

export function getMentalStateColor(state: string, theme: Theme): string {
    if (state === 'Stimulation-Seeking') {
        return theme.palette.mode === 'dark' ? '#A395F2' : '#946AF5';
    }
    if (state === 'Almost Ready') {
        return theme.palette.mode === 'dark' ? '#91B398' : '#56775C';
    }
    if (state === 'Ready') {
        return theme.palette.mode === 'dark' ? '#71AD82' : '#387D4E';
    }

    return theme.palette[stateTones[state] ?? 'primary'].main;
}
