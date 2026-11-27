import { format, parseISO } from 'date-fns';
import type { StatType } from '../../types/Stats';
import type { Path, SignalInput, WeekStrength } from '../../types/Path';
import { statNumericValueLabel } from '../stats/statVisualization';

export function formatInputValue(value: number, valueType: StatType | null, unit: string | null): string {
    if (valueType === 'DURATION') {
        const minutes = Math.max(0, Math.round(value));
        const hours = Math.floor(minutes / 60);
        if (hours === 0) return `${minutes}m`;
        return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
    }
    return statNumericValueLabel(Math.round(value * 10) / 10, valueType === 'BOOLEAN' ? null : unit);
}

/** "4×/wk", "2.6k words/wk", "≤ 30 g a day". */
export function targetSummary(input: SignalInput): string {
    const value = formatInputValue(input.target, input.valueType, input.unit);
    const atMost = input.direction === 'LESS_IS_BETTER' ? '≤ ' : '';
    switch (input.scoring) {
        case 'TIMES':
            return input.target === 1 && !atMost ? 'weekly' : `${atMost}${input.target}×/wk`;
        case 'TOTAL':
            return `${atMost}${value}/wk`;
        case 'DAYS_MET':
            return `${atMost}${value} a day`;
        case 'AVERAGE':
            return `avg ${atMost}${value}/day`;
    }
}

const COMBINE_LABELS = { AVERAGE: 'averaged', WEAKEST: 'weakest counts', ALL_MET: 'all must be met' } as const;

/** The line under a path's name: "Gym · 4×/wk", or "3 inputs · averaged". */
export function signalSummary(path: Path): string {
    const inputs = path.signal.inputs;
    if (inputs.length === 1) return `${inputs[0].statName ?? 'Deleted stat'} · ${targetSummary(inputs[0])}`;
    return `${inputs.length} inputs · ${COMBINE_LABELS[path.signal.combineMethod]}`;
}

/** What one input achieved in a week: "3 of 4", "Kept", "2.1k of 2.6k words". */
export function achievedText(input: SignalInput, achieved: number, elapsedDays: number): string {
    const value = (amount: number) => formatInputValue(amount, input.valueType, input.unit);
    const less = input.direction === 'LESS_IS_BETTER';
    switch (input.scoring) {
        case 'TIMES':
            if (input.target === 1 && !less) return achieved > 0 ? 'Kept' : 'Not kept';
            return less ? `${achieved}, at most ${input.target}` : `${achieved} of ${input.target}`;
        case 'TOTAL':
            return less ? `${value(achieved)}, at most ${value(input.target)}` : `${value(achieved)} of ${value(input.target)}`;
        case 'DAYS_MET':
            return `${achieved} of ${elapsedDays} days`;
        case 'AVERAGE':
            return `avg ${value(achieved)} of ${value(input.target)}`;
    }
}

/** The hover label of a week's centre dash: "Week of Nov 16 · 3 of 4", per input when there are several. */
export function weekLabel(path: Path, week: WeekStrength): string {
    const start = format(parseISO(`${week.weekStart}T12:00:00`), 'MMM d');
    const inputs = path.signal.inputs;
    const parts = inputs.map((input, index) => {
        const text = achievedText(input, week.inputs[index]?.achieved ?? 0, week.elapsedDays);
        return inputs.length === 1 ? text : `${input.statName ?? 'Deleted stat'} ${text}`;
    });
    return [`Week of ${start}`, ...parts].join(' · ');
}

/** Beside the today dot: "2/4" for a single count, otherwise the week's strength so far. */
export function todayText(path: Path, week: WeekStrength | null): string {
    if (!week) return '–';
    const inputs = path.signal.inputs;
    if (inputs.length === 1 && inputs[0].scoring === 'TIMES' && inputs[0].direction === 'MORE_IS_BETTER') {
        const done = week.inputs[0]?.achieved ?? 0;
        if (inputs[0].target === 1) return done > 0 ? 'kept' : '–';
        return `${done}/${inputs[0].target}`;
    }
    return `${Math.round(Math.min(week.strength, 1.25) * 100)}%`;
}
