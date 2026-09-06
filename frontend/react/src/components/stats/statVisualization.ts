import { Theme } from '@mui/material/styles';
import { StatDefinition } from '../../types/Stats';
import { formatTimeCircleValue, isTimeAtOrBeforeThreshold } from '../../services/utils/statValues';

export function compactTimeValue(value: number, definition?: StatDefinition): string {
    return formatTimeCircleValue(definition ?? {}, value);
}

export function statValueColor(definition: StatDefinition, value: number, theme: Theme): string {
    const morality = definition.morality ?? 'NEUTRAL';
    if (morality === 'NEUTRAL' || definition.goodThreshold == null) {
        return theme.palette.primary.main;
    }

    const isGood = definition.type === 'TIME'
        ? isTimeAtOrBeforeThreshold(definition, value, definition.goodThreshold)
        : morality === 'GOOD'
            ? value >= definition.goodThreshold
            : value <= definition.goodThreshold;
    return isGood ? theme.palette.success.main : theme.palette.error.main;
}

export function statValueLabel(definition: StatDefinition, value: number): string {
    if (definition.type === 'TIME') return compactTimeValue(value, definition);
    if (definition.type === 'DURATION') {
        const rounded = Math.max(0, Math.round(value));
        const hours = Math.floor(rounded / 60);
        const minutes = rounded % 60;
        if (hours === 0) return `${minutes}m`;
        return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
    }
    if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
