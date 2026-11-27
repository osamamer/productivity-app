import { describe, expect, it } from 'vitest';
import type { StatDefinition } from '../../types/Stats';
import type { Checkpoint } from '../../types/Path';
import { formFromCheckpoint, newCheckpointForm, toCheckpointDraft } from './checkpointDraft';

const words: StatDefinition = { id: 'words', name: 'Words', type: 'NUMBER', unit: 'words', displayOrder: 0, userId: 'u' };
const practice: StatDefinition = { id: 'practice', name: 'Practice', type: 'BOOLEAN', additionalInputTypes: ['DURATION'], displayOrder: 1, userId: 'u' };

describe('checkpoint drafts', () => {
    it('start counting from the given day and count days for yes/no stats', () => {
        expect(newCheckpointForm(words, '2026-11-01')).toMatchObject({ aggregation: 'SUM', countFrom: '2026-11-01', baseline: '0' });
        expect(newCheckpointForm(practice, '2026-11-01').aggregation).toBe('COUNT_DAYS');
    });

    it('need a name, a stat and a target', () => {
        const form = { ...newCheckpointForm(words, '2026-11-01'), name: 'Act II done' };
        expect(toCheckpointDraft({ ...form, name: ' ' }, [words])).toBe('Give the checkpoint a name.');
        expect(toCheckpointDraft({ ...form, statDefinitionId: 'gone' }, [words])).toMatch(/Choose the stat/);
        expect(toCheckpointDraft(form, [words])).toMatch(/Set the value/);
    });

    it('carry the starting amount and an optional date', () => {
        const form = { ...newCheckpointForm(words, '2026-11-01'), name: 'Act II done', baseline: '70100', target: '99000' };
        expect(toCheckpointDraft(form, [words])).toEqual({
            name: 'Act II done', targetDate: null, statDefinitionId: 'words', valueSource: 'VALUE', aggregation: 'SUM',
            countFrom: '2026-11-01', baseline: 70100, targetValue: 99000,
        });
    });

    it('send durations in minutes and read them back in hours', () => {
        const form = { ...newCheckpointForm(practice, '2026-11-01'), name: '50 hours', valueSource: 'DURATION', aggregation: 'SUM' as const, target: '50' };
        const draft = toCheckpointDraft(form, [practice]);
        expect(typeof draft === 'string' ? draft : draft.targetValue).toBe(3000);

        const saved = {
            id: 'c', projectId: 'p', name: '50 hours', targetDate: '2027-01-01', displayOrder: 0, current: 0, progress: 0,
            reachedOn: null, taskCount: 0, completedTaskCount: 0,
            metric: { statDefinitionId: 'practice', statName: 'Practice', unit: null, valueSource: 'DURATION', valueType: 'DURATION',
                aggregation: 'SUM', countFrom: '2026-11-01', baseline: 90, targetValue: 3000, falling: false },
        } satisfies Checkpoint;
        expect(formFromCheckpoint(saved)).toMatchObject({ target: '50', baseline: '1.5', targetDate: '2027-01-01' });
    });
});
