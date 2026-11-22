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

export type PlannedTimeKind = 'activity' | 'focus';

/**
 * Planned time is shaded in grey pencil, never filled like an event: an activity chunk with
 * single diagonal hatching, planned focus with cross-hatching. The calendar grid and the day
 * view share this so a chunk looks the same wherever it is drawn.
 */
export function plannedTimeFill(kind: PlannedTimeKind, theme: Theme): string {
    const line = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.2 : 0.16);
    const base = `linear-gradient(${alpha(theme.palette.text.primary, 0.035)}, ${alpha(theme.palette.text.primary, 0.035)})`;
    const forward = `repeating-linear-gradient(45deg, ${line} 0 1.5px, transparent 1.5px 7px)`;
    if (kind === 'activity') return `${forward}, ${base}`;
    const back = `repeating-linear-gradient(-45deg, ${line} 0 1.5px, transparent 1.5px 7px)`;
    return `${forward}, ${back}, ${base}`;
}

/** Border of planned time: an activity chunk keeps its activity's colour on the leading edge; focus is dashed grey. */
export function plannedTimeBorder(kind: PlannedTimeKind, theme: Theme, activityColor?: string | null) {
    const grey = alpha(theme.palette.text.primary, 0.35);
    if (kind === 'focus') return { border: `1px dashed ${grey}` };
    return { border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`, borderLeft: `3px solid ${activityColor || grey}` };
}

export function plannedBlockStyle(block: PlannedBlock, theme: Theme) {
    // Time actually spent is drawn solid; plans are drawn shaded.
    if (block.kind === 'timer') return { border: 1, borderColor: block.color ?? theme.palette.secondary.main, bgcolor: alpha(block.color ?? theme.palette.secondary.main, 0.75), color: '#fff' };
    if (block.shade) return { ...plannedTimeBorder(block.shade, theme, block.color), background: plannedTimeFill(block.shade, theme), color: 'text.primary' };
    if (block.color) return { border: 1, borderColor: block.color, bgcolor: alpha(block.color, 0.22) };
    const color = block.kind === 'focus' ? theme.palette.secondary.main : theme.palette.primary.main;
    return { border: 1, borderColor: block.kind === 'focus' ? 'secondary.main' : 'primary.main', bgcolor: alpha(color, 0.18) };
}
