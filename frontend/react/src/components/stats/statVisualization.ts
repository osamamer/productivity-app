import { Theme } from '@mui/material/styles';
import { StatDefinition } from '../../types/Stats';
import type { StatType } from '../../types/Stats';
import { formatTimeCircleValue, isTimeAtOrAfterThreshold, isTimeAtOrBeforeThreshold } from '../../services/utils/statValues';

export function compactTimeValue(value: number, definition?: StatDefinition): string {
    return formatTimeCircleValue(definition ?? {}, value);
}

export function statValueColor(definition: StatDefinition, value: number, theme: Theme): string {
    const morality = definition.morality ?? 'NEUTRAL';
    if (morality === 'NEUTRAL' || definition.goodThreshold == null) {
        return theme.palette.primary.main;
    }

    const isGood = definition.type === 'TIME'
        ? morality === 'BAD'
            ? isTimeAtOrAfterThreshold(definition, value, definition.goodThreshold)
            : isTimeAtOrBeforeThreshold(definition, value, definition.goodThreshold)
        : morality === 'GOOD'
            ? value >= definition.goodThreshold
            : value <= definition.goodThreshold;
    return isGood ? theme.palette.success.main : theme.palette.error.main;
}

export function statNumericValueLabel(value: number, unit?: string | null): string {
    const label = Math.abs(value) >= 10000 ? `${Math.round(value / 1000)}k`
        : Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k`
            : Number.isInteger(value) ? String(value) : value.toFixed(1);
    return unit ? `${label} ${unit}` : label;
}

export function statValueLabel(definition: StatDefinition, value: number, type: StatType = definition.type): string {
    if (type === 'TIME') return compactTimeValue(value, definition);
    if (type === 'DURATION') {
        const rounded = Math.max(0, Math.round(value));
        const hours = Math.floor(rounded / 60);
        const minutes = rounded % 60;
        if (hours === 0) return `${minutes}m`;
        return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
    }
    return statNumericValueLabel(value, type === 'NUMBER' ? definition.unit : null);
}
