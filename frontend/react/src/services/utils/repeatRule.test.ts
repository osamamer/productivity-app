import { describe, expect, it } from 'vitest';
import {
    fieldsFromRepeatRule,
    isWeekdayOccurrence,
    repeatRuleFromFields,
    repeatSummary,
    upcomingOccurrenceDates,
    weekdayOccurrencesBetween,
} from '../../../../shared/repeatRule.ts';

describe('repeat rules and API fields', () => {
    it('stores every-one rules as plain frequencies and longer gaps as custom ones', () => {
        expect(fieldsFromRepeatRule({ kind: 'DAILY', every: 1, days: [], until: null }).recurrenceFrequency).toBe('DAILY');
        expect(fieldsFromRepeatRule({ kind: 'MONTHLY', every: 3, days: [], until: null })).toMatchObject({
            recurrenceFrequency: 'CUSTOM', recurrenceInterval: 3, recurrenceUnit: 'MONTHS',
        });
    });

    it('stores chosen weekdays as a custom rule counted in weeks, Sunday first', () => {
        expect(fieldsFromRepeatRule({ kind: 'WEEKLY', every: 2, days: ['THURSDAY', 'MONDAY'], until: '2027-01-01' }))
            .toEqual({
                recurrenceFrequency: 'CUSTOM',
                recurrenceInterval: 2,
                recurrenceUnit: 'WEEKS',
                recurrenceDaysOfWeek: ['MONDAY', 'THURSDAY'],
                recurrenceEndDate: '2027-01-01',
            });
    });

    it('reads old custom rules back as Daily, Weekly or Monthly', () => {
        expect(repeatRuleFromFields({ recurrenceFrequency: 'CUSTOM', recurrenceInterval: 4, recurrenceUnit: 'DAYS' }))
            .toEqual({ kind: 'DAILY', every: 4, days: [], until: null });
        expect(repeatRuleFromFields({
            recurrenceFrequency: 'CUSTOM', recurrenceInterval: 1, recurrenceUnit: 'WEEKS',
            recurrenceDaysOfWeek: ['FRIDAY', 'SUNDAY'],
        })).toEqual({ kind: 'WEEKLY', every: 1, days: ['SUNDAY', 'FRIDAY'], until: null });
    });
});

describe('repeatSummary', () => {
    it('says how often and on which days', () => {
        expect(repeatSummary({ kind: 'WEEKLY', every: 2, days: ['MONDAY', 'THURSDAY'], until: null }))
            .toBe('Every 2 weeks on Mon, Thu');
        expect(repeatSummary({ kind: 'WEEKLY', every: 1, days: ['MONDAY'], until: null })).toBe('Every week on Mon');
        expect(repeatSummary({ kind: 'DAILY', every: 3, days: [], until: null })).toBe('Every 3 days');
        expect(repeatSummary({ kind: 'MONTHLY', every: 1, days: [], until: null })).toBe('Monthly');
    });

    it('has a short form for narrow places', () => {
        expect(repeatSummary({ kind: 'WEEKLY', every: 2, days: ['MONDAY', 'THURSDAY'], until: null }, true))
            .toBe('2 wk · Mon, Thu');
    });
});

describe('every N weeks on chosen days', () => {
    // Thursday 2 Jan 2025; weeks start on Sunday, so Sunday 5 Jan opens week 1.
    const anchor = '2025-01-02';

    it('repeats in the start week and every second week after it', () => {
        expect(weekdayOccurrencesBetween(anchor, ['SUNDAY', 'THURSDAY'], 2, '2025-01-01', '2025-01-26'))
            .toEqual(['2025-01-02', '2025-01-12', '2025-01-16', '2025-01-26']);
    });

    it('never repeats before the start date', () => {
        expect(isWeekdayOccurrence(anchor, '2024-12-29', ['SUNDAY'], 1)).toBe(false);
    });

    it('previews upcoming dates and stops at the end date', () => {
        expect(upcomingOccurrenceDates(
            { kind: 'WEEKLY', every: 1, days: ['MONDAY'], until: '2025-01-13' }, anchor, anchor, 5,
        )).toEqual(['2025-01-06', '2025-01-13']);
        expect(upcomingOccurrenceDates({ kind: 'MONTHLY', every: 1, days: [], until: null }, '2025-01-31', '2025-01-31', 3))
            .toEqual(['2025-01-31', '2025-02-28', '2025-03-31']);
    });
});
