import { alpha, type Theme } from '@mui/material/styles';
import { PlannedBlock, ScreenBlock } from './dayTimelineLayout';

// Shared look of timeline blocks, so the Day page strip and the calendar's day view read alike.

export const hatch = (color: string) => `repeating-linear-gradient(135deg, ${color} 0 4px, transparent 4px 8px)`;

/** Fill for a screen block; `direction` is the time axis, so switching stripes run along it. */
export function screenBlockStyle(block: ScreenBlock, theme: Theme, direction: 'horizontal' | 'vertical' = 'horizontal') {
    if (block.kind === 'app') return { bgcolor: block.color };
    if (block.kind === 'switching') {
        const angle = direction === 'horizontal' ? '90deg' : '180deg';
        return { background: `repeating-linear-gradient(${angle}, ${block.apps.map((app, index) => `${app.color} ${index * 6}px ${(index + 1) * 6}px`).join(', ')})`, opacity: 0.75 };
    }
    if (block.kind === 'away') return { bgcolor: alpha(theme.palette.text.primary, 0.06) };
    return { background: hatch(alpha(theme.palette.text.primary, 0.08)) };
}

export function plannedBlockStyle(block: PlannedBlock, theme: Theme) {
    if (block.color) return { border: 1, borderColor: block.color, bgcolor: alpha(block.color, 0.22) };
    const color = block.kind === 'focus' ? theme.palette.secondary.main : theme.palette.primary.main;
    return { border: 1, borderColor: block.kind === 'focus' ? 'secondary.main' : 'primary.main', bgcolor: alpha(color, 0.18) };
}
