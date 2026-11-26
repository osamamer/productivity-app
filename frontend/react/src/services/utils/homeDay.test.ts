import { describe, expect, it } from 'vitest';
import { getHomeDisplayDate, homeDayTailDateKey, isInHomeDay } from './homeDay';
import { splitTasksByDate } from './taskDateBuckets';
import { makeTask } from '../../test/fakeBackend';

const DAY = '2026-11-26';

describe('isInHomeDay', () => {
    it('covers the whole Home date', () => {
        expect(isInHomeDay('2026-11-26T00:00:00', DAY, 4)).toBe(true);
        expect(isInHomeDay('2026-11-26T23:59:00', DAY, 4)).toBe(true);
    });

    it('runs into the next date until the day-end hour', () => {
        expect(isInHomeDay('2026-11-27T03:59:00', DAY, 4)).toBe(true);
        expect(isInHomeDay('2026-11-27T04:00:00', DAY, 4)).toBe(false);
    });

    it('stops at midnight when the day ends at midnight', () => {
        expect(isInHomeDay('2026-11-27T01:00:00', DAY, 0)).toBe(false);
        expect(homeDayTailDateKey(DAY, 0)).toBeNull();
    });

    it('keeps an early-morning task on its own date once that day starts', () => {
        expect(isInHomeDay('2026-11-27T02:00:00', '2026-11-27', 4)).toBe(true);
    });

    it('rolls over across months', () => {
        expect(isInHomeDay('2026-12-01T01:00:00', '2026-11-30', 4)).toBe(true);
    });

    it('is false for unscheduled tasks', () => {
        expect(isInHomeDay(null, DAY, 4)).toBe(false);
    });
});

describe('splitTasksByDate with a day-end hour', () => {
    it('puts a task after midnight but before the day ends with the Home day', () => {
        const now = new Date(2026, 10, 27, 1, 0);
        const displayDate = getHomeDisplayDate(now, 4);
        const lateNight = makeTask({ name: 'Late night', scheduledPerformDateTime: '2026-11-27T02:00:00' });
        const later = makeTask({ name: 'Later', scheduledPerformDateTime: '2026-11-27T10:00:00' });

        const buckets = splitTasksByDate([lateNight, later], '2026-11-26', 4);

        expect(displayDate.getDate()).toBe(26);
        expect(buckets.today.map(task => task.name)).toEqual(['Late night']);
        expect(buckets.future.map(task => task.name)).toEqual(['Later']);
    });
});
