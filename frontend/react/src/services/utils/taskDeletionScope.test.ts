import { describe, expect, it } from 'vitest';
import { makeTask } from '../../test/fakeBackend';
import type { Task } from '../../types/Task';
import { requestHasRecurringTasks, tasksForDeleteScope, type DeleteRequest } from './taskDeletionScope';

const anchorEl = {} as HTMLElement;

function occurrence(seriesId: string, date: string, name = `${seriesId} ${date}`): Task {
    return makeTask({ name, taskSeriesId: seriesId, seriesOccurrenceAt: `${date}T09:00:00`, scheduledPerformDateTime: `${date}T09:00:00` });
}

function single(task: Task): DeleteRequest {
    return { kind: 'single', tasks: [task], anchorEl };
}

const names = (tasks: Task[]) => tasks.map(task => task.name).sort();

describe('tasksForDeleteScope', () => {
    const monday = occurrence('gym', '2026-11-23', 'gym mon');
    const wednesday = occurrence('gym', '2026-11-25', 'gym wed');
    const friday = occurrence('gym', '2026-11-27', 'gym fri');
    const reading = occurrence('read', '2026-11-27', 'read fri');
    const plain = makeTask({ name: 'plain' });
    const allTasks = [monday, wednesday, friday, reading, plain];

    it('deletes only the chosen tasks for a single occurrence', () => {
        expect(names(tasksForDeleteScope(single(wednesday), 'occurrence', allTasks))).toEqual(['gym wed']);
    });

    it('keeps the chosen occurrence and deletes every later one of its series for "future"', () => {
        // The backend ends the series at the chosen occurrence, so that one stays.
        expect(names(tasksForDeleteScope(single(wednesday), 'future', allTasks))).toEqual(['gym fri']);
    });

    it('also deletes plain tasks chosen alongside a recurring one in a "future" delete', () => {
        const request: DeleteRequest = { kind: 'bulk', tasks: [wednesday, plain], anchorEl };

        expect(names(tasksForDeleteScope(request, 'future', allTasks))).toEqual(['gym fri', 'plain']);
    });

    it('measures "future" from the earliest chosen occurrence when several are selected', () => {
        const request: DeleteRequest = { kind: 'bulk', tasks: [friday, monday], anchorEl };

        expect(names(tasksForDeleteScope(request, 'future', allTasks))).toEqual(['gym fri', 'gym wed']);
    });

    it('deletes every loaded occurrence of the series for "series", and nothing from other series', () => {
        expect(names(tasksForDeleteScope(single(wednesday), 'series', allTasks))).toEqual(['gym fri', 'gym mon', 'gym wed']);
    });
});

describe('requestHasRecurringTasks', () => {
    it('is true only when a chosen task belongs to a series', () => {
        expect(requestHasRecurringTasks(single(makeTask({ name: 'plain' })))).toBe(false);
        expect(requestHasRecurringTasks(single(occurrence('gym', '2026-11-23')))).toBe(true);
    });
});
