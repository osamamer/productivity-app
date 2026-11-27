import { describe, expect, it } from 'vitest';
import type { Path, SignalInput, WeekStrength } from '../../types/Path';
import { achievedText, signalSummary, targetSummary, todayText, weekLabel } from './signalText';

function input(overrides: Partial<SignalInput>): SignalInput {
    return {
        id: 'input', statDefinitionId: 'stat', statName: 'Gym', unit: null, valueSource: 'VALUE', valueType: 'BOOLEAN',
        direction: 'MORE_IS_BETTER', period: 'WEEK', scoring: 'TIMES', target: 4, weight: 1, ...overrides,
    };
}

function path(inputs: SignalInput[]): Path {
    return { id: 'p', name: 'Body', color: '#F08E84', icon: 'body', displayOrder: 0, paused: false,
        signal: { combineMethod: 'AVERAGE', inputs } };
}

const week = (achieved: number[], strength = 0.75): WeekStrength => ({
    weekStart: '2026-11-15', elapsedDays: 7, strength, inputs: achieved.map(value => ({ score: 0, achieved: value })),
});

describe('signal text', () => {
    it('summarises a single input under the path name', () => {
        expect(signalSummary(path([input({})]))).toBe('Gym · 4×/wk');
        expect(signalSummary(path([input({}), input({ statName: null })]))).toBe('2 inputs · averaged');
    });

    it('describes targets in the stat’s terms', () => {
        expect(targetSummary(input({ target: 1 }))).toBe('weekly');
        expect(targetSummary(input({ scoring: 'TOTAL', valueType: 'NUMBER', unit: 'words', target: 2600 }))).toBe('2.6k words/wk');
        expect(targetSummary(input({ scoring: 'DAYS_MET', valueType: 'NUMBER', unit: 'g', target: 30, direction: 'LESS_IS_BETTER' })))
            .toBe('≤ 30 g a day');
        expect(targetSummary(input({ scoring: 'TOTAL', valueType: 'DURATION', target: 150 }))).toBe('2h 30m/wk');
    });

    it('says what a week achieved', () => {
        expect(achievedText(input({}), 3, 7)).toBe('3 of 4');
        expect(achievedText(input({ target: 1 }), 0, 7)).toBe('Not kept');
        expect(achievedText(input({ scoring: 'DAYS_MET', valueType: 'NUMBER', target: 120 }), 4, 5)).toBe('4 of 5 days');
    });

    it('labels a week, per input when there are several', () => {
        expect(weekLabel(path([input({})]), week([3]))).toBe('Week of Nov 15 · 3 of 4');
        expect(weekLabel(path([input({}), input({ statName: 'Run', target: 2 })]), week([3, 1])))
            .toBe('Week of Nov 15 · Gym 3 of 4 · Run 1 of 2');
    });

    it('shows the count beside today for a single count, and the strength otherwise', () => {
        expect(todayText(path([input({})]), week([2]))).toBe('2/4');
        expect(todayText(path([input({ scoring: 'TOTAL', valueType: 'NUMBER' })]), week([500], 0.5))).toBe('50%');
        expect(todayText(path([input({})]), null)).toBe('–');
    });
});
