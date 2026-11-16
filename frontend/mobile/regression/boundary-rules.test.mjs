import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyRule,
  isLooser,
  parseTime,
  summarizeRule,
  windowContains,
} from '../src/lib/boundaryRules.ts';

const rule = patch => ({ ...emptyRule('x'), ...patch });
const workHours = { days: [1, 2, 3, 4, 5], start: 540, end: 1020 };

test('a time window covers its days between start and end', () => {
  assert.equal(windowContains(workHours, 1, 600), true);
  assert.equal(windowContains(workHours, 1, 1020), false);
  assert.equal(windowContains(workHours, 0, 600), false);
});

test('a window ending before it starts runs past midnight and belongs to its start day', () => {
  const fridayNight = { days: [5], start: 22 * 60, end: 6 * 60 };
  assert.equal(windowContains(fridayNight, 5, 23 * 60), true);
  assert.equal(windowContains(fridayNight, 6, 5 * 60), true);
  assert.equal(windowContains(fridayNight, 6, 7 * 60), false);
  assert.equal(windowContains(fridayNight, 5, 5 * 60), false);
});

test('a window with the same start and end covers the whole day', () => {
  assert.equal(windowContains({ days: [2], start: 0, end: 0 }, 2, 1439), true);
});

test('new rules and tighter rules save without the master password', () => {
  assert.equal(isLooser(undefined, rule({ blockMode: 'always' })), false);
  assert.equal(isLooser(rule({ dailyLimitMin: 30 }), rule({ dailyLimitMin: 20 })), false);
  assert.equal(isLooser(rule({ dailyLimitMin: 30 }), rule({ blockMode: 'always' })), false);
  assert.equal(isLooser(rule({ maxOpens: 3 }), rule({ maxOpens: 3, sessionMin: 10 })), false);
});

test('loosening or removing a rule needs the master password', () => {
  assert.equal(isLooser(rule({ blockMode: 'always' }), null), true);
  assert.equal(isLooser(rule({ blockMode: 'always' }), rule({ dailyLimitMin: 30 })), true);
  assert.equal(isLooser(rule({ dailyLimitMin: 30 }), rule({ dailyLimitMin: 40 })), true);
  assert.equal(isLooser(rule({ maxOpens: 3 }), rule({})), true);
  assert.equal(isLooser(rule({ maxOpens: 3 }), rule({ maxOpens: 3, limitWindows: [{ days: [1], start: 0, end: 0 }] })), true);
  assert.equal(isLooser(
    rule({ blockMode: 'scheduled', blockWindows: [{ days: [1, 2], start: 540, end: 1020 }] }),
    rule({ blockMode: 'scheduled', blockWindows: [{ days: [1], start: 540, end: 1020 }] }),
  ), true);
});

test('times are typed as 24-hour H:MM', () => {
  assert.equal(parseTime('9:05'), 545);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('abc'), null);
});

test('rules read as a short sentence in the app list', () => {
  assert.equal(summarizeRule(rule({ blockMode: 'scheduled', blockWindows: [workHours] })), 'Blocked Weekdays 09:00–17:00');
  assert.equal(summarizeRule(rule({ dailyLimitMin: 30, maxOpens: 3 })), '30 min/day, 3 opens/day');
  assert.equal(summarizeRule(rule({})), 'No restriction');
});
