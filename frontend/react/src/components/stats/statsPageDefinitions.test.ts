import { describe, expect, it } from 'vitest';
import type { StatDefinition } from '../../types/Stats';
import { canCreateRecurringTask, isDedicatedStat, isEditableSystemStat } from './statsPageDefinitions';

function definition(overrides: Partial<StatDefinition>): StatDefinition {
    return { id: 'stat-1', name: 'Stat', type: 'NUMBER', ...overrides } as StatDefinition;
}

describe('isDedicatedStat', () => {
    it('keeps system stats with their own page off the Stats list', () => {
        expect(isDedicatedStat(definition({ systemKey: 'energy' }))).toBe(true);
        expect(isDedicatedStat(definition({ systemKey: 'meditation_minutes' }))).toBe(true);
    });

    it('lists "meditated" only when the user chose to show it on the Stats page', () => {
        expect(isDedicatedStat(definition({ systemKey: 'meditated', showOnStatsPage: false }))).toBe(true);
        expect(isDedicatedStat(definition({ systemKey: 'meditated', showOnStatsPage: true }))).toBe(false);
    });

    it('lists the user\'s own stats and other system stats', () => {
        expect(isDedicatedStat(definition({}))).toBe(false);
        expect(isDedicatedStat(definition({ systemKey: 'sleep_hours' }))).toBe(false);
    });
});

describe('isEditableSystemStat', () => {
    it('allows editing only the sleep system stats', () => {
        expect(isEditableSystemStat(definition({ systemKey: 'sleep_time' }))).toBe(true);
        expect(isEditableSystemStat(definition({ systemKey: 'energy' }))).toBe(false);
        expect(isEditableSystemStat(definition({}))).toBe(false);
    });
});

describe('canCreateRecurringTask', () => {
    it('offers a recurring task for yes/no stats that do not have one yet', () => {
        expect(canCreateRecurringTask(definition({ type: 'BOOLEAN' }))).toBe(true);
        expect(canCreateRecurringTask(definition({ type: 'BOOLEAN', recurringTaskSeriesId: 'series-1' }))).toBe(false);
        expect(canCreateRecurringTask(definition({ type: 'NUMBER' }))).toBe(false);
    });
});
