import { describe, expect, it } from 'vitest';
import type { Checkpoint, Milestone } from '../../types/Path';
import { activeMilestone, brightUntilY, checkpointMarks, milestoneMarks } from './milestoneLayout';
import { checkpointLabel, milestoneSubtitle } from './milestoneText';
import { SOMEDAY_Y, timeScale, TODAY_Y, WEEK_PX } from './roadLayout';

const scale = timeScale('2026-11-22', 52);

function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
    return {
        id: 'c', projectId: 'p', name: 'Act II done', targetDate: '2027-02-25', displayOrder: 0,
        metric: { statDefinitionId: 'words', statName: 'Words', unit: 'words', valueSource: 'VALUE', valueType: 'NUMBER',
            aggregation: 'SUM', countFrom: '2026-11-01', baseline: 70_100, targetValue: 99_000, falling: false },
        current: 72_100, progress: 0.73, reachedOn: null, taskCount: 0, completedTaskCount: 0, ...overrides,
    };
}

function milestone(id: string, overrides: Partial<Milestone> = {}): Milestone {
    return {
        id, projectId: `project-${id}`, name: id, targetDate: null, displayOrder: 0, done: false, doneOn: null,
        progress: 0, taskCount: 0, completedTaskCount: 0, checkpoints: [], ...overrides,
    };
}

describe('milestone rings', () => {
    it('put the first open milestone ahead as the active one, at its date', () => {
        const marks = milestoneMarks([milestone('rewrite', { targetDate: '2026-12-13' }), milestone('edit', { targetDate: '2027-03-07' })], scale);
        expect(marks.map(mark => mark.kind)).toEqual(['active', 'future']);
        expect(marks[0].y).toBe(TODAY_Y - 2 * WEEK_PX);
    });

    it('stack undated milestones in the Someday zone in their order', () => {
        const marks = milestoneMarks([milestone('edit'), milestone('publish')], scale);
        expect(marks.map(mark => mark.kind)).toEqual(['someday', 'someday']);
        expect(marks[0].y).toBeLessThan(SOMEDAY_Y);
        expect(marks[1].y).toBeLessThan(marks[0].y);
        expect(marks[1].y).toBeGreaterThan(0);
    });

    it('fit many Someday milestones above the zone', () => {
        const many = Array.from({ length: 8 }, (_, index) => milestone(`m${index}`));
        milestoneMarks(many, scale).forEach(mark => expect(mark.y).toBeGreaterThan(0));
    });

    it('draw done milestones on the past road on the day they were done', () => {
        const marks = milestoneMarks([milestone('10k', { done: true, doneOn: '2026-11-15' })], scale);
        expect(marks).toEqual([expect.objectContaining({ kind: 'done', y: TODAY_Y + 2 * WEEK_PX })]);
    });

    it('leave out done milestones older than the drawn past', () => {
        expect(milestoneMarks([milestone('old', { done: true, doneOn: '2020-01-01' })], scale)).toEqual([]);
    });

    it('skip done milestones when choosing the active one', () => {
        expect(activeMilestone([milestone('a', { done: true }), milestone('b')])?.id).toBe('b');
    });

    it('brighten the future road up to the active ring', () => {
        const marks = milestoneMarks([milestone('rewrite', { targetDate: '2027-07-22' })], scale);
        expect(brightUntilY(marks)).toBe(marks[0].y);
        expect(brightUntilY([])).toBe(TODAY_Y);
    });
});

describe('checkpoint ticks', () => {
    it('mark dated checkpoints of open milestones only', () => {
        const open = milestone('rewrite', { checkpoints: [checkpoint(), checkpoint({ id: 'undated', targetDate: null })] });
        const done = milestone('old', { done: true, doneOn: '2026-11-01', checkpoints: [checkpoint({ id: 'past' })] });
        expect(checkpointMarks([open, done], scale).map(mark => mark.checkpoint.id)).toEqual(['c']);
    });
});

describe('milestone text', () => {
    it('describes rings by progress and date, done date, or as not planned', () => {
        expect(milestoneSubtitle(milestone('a', { targetDate: '2027-07-22', progress: 0.49 }))).toBe('49% · Jul 22');
        expect(milestoneSubtitle(milestone('a', { done: true, doneOn: '2026-06-20' }))).toBe('Done · Jun 20');
        expect(milestoneSubtitle(milestone('a'))).toBe('not planned yet');
    });

    it('labels a checkpoint tick with its name, date and progress', () => {
        expect(checkpointLabel(checkpoint())).toBe('Act II done · Feb 25 · 72k of 99k words');
        expect(checkpointLabel(checkpoint({ reachedOn: '2026-11-24' }))).toBe('Act II done · Feb 25 · ✓ reached Nov 24');
    });
});
