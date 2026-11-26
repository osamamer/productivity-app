import { describe, expect, it } from 'vitest';
import { makeTask } from '../../test/fakeBackend';
import { homeTodayTasks, olderHomeTasks, visibleHomeTasks } from './homeTaskBuckets';

const DAY = '2026-11-26';
const at = (date: string) => `${date}T09:00:00`;

describe('homeTodayTasks', () => {
    it('keeps main tasks scheduled for the Home day and drops subtasks', () => {
        const today = makeTask({ name: 'Today', scheduledPerformDateTime: at(DAY) });
        const subtask = makeTask({ name: 'Sub', scheduledPerformDateTime: at(DAY), parentId: today.taskId });
        const tomorrow = makeTask({ name: 'Tomorrow', scheduledPerformDateTime: at('2026-11-27') });

        const result = homeTodayTasks({
            allTasks: [today, subtask, tomorrow], todayTasks: [], homeDayKey: DAY, dayEndHour: 0,
            activeTaskId: null, resolvedActiveTask: null,
        });

        expect(result.map(task => task.name)).toEqual(['Today']);
    });

    it('prefers the latest copy in allTasks over a stale today snapshot', () => {
        const stale = makeTask({ taskId: 't1', name: 'Old name', scheduledPerformDateTime: at(DAY) });
        const latest = { ...stale, name: 'New name' };

        const result = homeTodayTasks({
            allTasks: [latest], todayTasks: [stale], homeDayKey: DAY, dayEndHour: 0,
            activeTaskId: null, resolvedActiveTask: null,
        });

        expect(result.map(task => task.name)).toEqual(['New name']);
    });

    it('drops a task the latest copy has moved to another day', () => {
        const stale = makeTask({ taskId: 't1', name: 'Moved', scheduledPerformDateTime: at(DAY) });
        const moved = { ...stale, scheduledPerformDateTime: at('2026-11-30') };

        const result = homeTodayTasks({
            allTasks: [moved], todayTasks: [stale], homeDayKey: DAY, dayEndHour: 0,
            activeTaskId: null, resolvedActiveTask: null,
        });

        expect(result).toEqual([]);
    });

    it('includes the next morning before the day-end hour', () => {
        const lateNight = makeTask({ name: 'Late night', scheduledPerformDateTime: '2026-11-27T02:30:00' });
        const nextMorning = makeTask({ name: 'Next morning', scheduledPerformDateTime: '2026-11-27T04:00:00' });

        const result = homeTodayTasks({
            allTasks: [lateNight, nextMorning], todayTasks: [], homeDayKey: DAY, dayEndHour: 4,
            activeTaskId: null, resolvedActiveTask: null,
        });

        expect(result.map(task => task.name)).toEqual(['Late night']);
    });

    it('includes the task with the running Pomodoro even from another day', () => {
        const focused = makeTask({ name: 'Focused', scheduledPerformDateTime: at('2026-11-20') });

        const fromState = homeTodayTasks({
            allTasks: [focused], todayTasks: [], homeDayKey: DAY, dayEndHour: 0,
            activeTaskId: focused.taskId, resolvedActiveTask: null,
        });
        const fetchedSeparately = homeTodayTasks({
            allTasks: [], todayTasks: [], homeDayKey: DAY, dayEndHour: 0,
            activeTaskId: focused.taskId, resolvedActiveTask: focused,
        });

        expect(fromState.map(task => task.name)).toEqual(['Focused']);
        expect(fetchedSeparately.map(task => task.name)).toEqual(['Focused']);
    });
});

describe('visibleHomeTasks', () => {
    const base = { allTasks: [], pendingDateTaskIds: [], pendingDateEdits: new Map(), pendingDeletedTaskIds: new Set<string>(), activeTaskId: null };

    it('hides completed tasks unless asked to show them, but never the focused one', () => {
        const open = makeTask({ name: 'Open' });
        const done = makeTask({ name: 'Done', completed: true });
        const focusedDone = makeTask({ name: 'Focused done', completed: true });

        const hidden = visibleHomeTasks({ ...base, todayTasks: [open, done, focusedDone], showCompleted: false, activeTaskId: focusedDone.taskId });
        const shown = visibleHomeTasks({ ...base, todayTasks: [open, done], showCompleted: true });

        expect(hidden.map(task => task.name)).toEqual(['Open', 'Focused done']);
        expect(shown.map(task => task.name)).toEqual(['Open', 'Done']);
    });

    it('leaves out tasks whose deletion is in flight', () => {
        const kept = makeTask({ name: 'Kept' });
        const deleting = makeTask({ name: 'Deleting' });

        const result = visibleHomeTasks({ ...base, todayTasks: [kept, deleting], showCompleted: false, pendingDeletedTaskIds: new Set([deleting.taskId]) });

        expect(result.map(task => task.name)).toEqual(['Kept']);
    });

    it('holds a task being moved off today in its original slot until the edit finishes', () => {
        const first = makeTask({ name: 'First' });
        const moving = makeTask({ name: 'Moving', scheduledPerformDateTime: at('2026-11-30') });
        const last = makeTask({ name: 'Last' });

        const result = visibleHomeTasks({
            ...base,
            todayTasks: [first, last],
            allTasks: [first, moving, last],
            showCompleted: false,
            pendingDateTaskIds: [moving.taskId],
            pendingDateEdits: new Map([[moving.taskId, { originalDateTime: at(DAY), latestDateTime: at('2026-11-30'), originalIndex: 1 }]]),
        });

        expect(result.map(task => task.name)).toEqual(['First', 'Moving', 'Last']);
    });
});

describe('olderHomeTasks', () => {
    it('keeps unfinished main tasks from before the Home day', () => {
        const older = makeTask({ name: 'Older', scheduledPerformDateTime: at('2026-11-20') });
        const finished = makeTask({ name: 'Finished', completed: true, scheduledPerformDateTime: at('2026-11-20') });
        const subtask = makeTask({ name: 'Sub', parentId: older.taskId, scheduledPerformDateTime: at('2026-11-20') });
        const rescheduledToday = makeTask({ name: 'Now today', scheduledPerformDateTime: at(DAY) });

        const result = olderHomeTasks([older, finished, subtask, rescheduledToday], DAY, 0, new Set());

        expect(result.map(task => task.name)).toEqual(['Older']);
    });
});
