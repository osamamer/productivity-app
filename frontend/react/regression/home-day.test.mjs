import assert from 'node:assert/strict';
import test from 'node:test';
import { getHomeDisplayDate, getNextHomeDayBoundary } from '../src/services/utils/homeDay.ts';

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

test('midnight remains the default Home day boundary', () => {
  assert.equal(dateKey(getHomeDisplayDate(new Date(2026, 10, 12, 0, 0), 0)), '2026-11-12');
});

test('Home keeps the previous date active until the selected hour', () => {
  assert.equal(dateKey(getHomeDisplayDate(new Date(2026, 10, 12, 4, 59), 5)), '2026-11-11');
  assert.equal(dateKey(getHomeDisplayDate(new Date(2026, 10, 12, 5, 0), 5)), '2026-11-12');
});

test('the next boundary is local and advances to tomorrow after it has passed', () => {
  assert.equal(
    getNextHomeDayBoundary(new Date(2026, 10, 12, 2, 30), 4).getTime(),
    new Date(2026, 10, 12, 4, 0).getTime(),
  );
  assert.equal(
    getNextHomeDayBoundary(new Date(2026, 10, 12, 5, 0), 4).getTime(),
    new Date(2026, 10, 13, 4, 0).getTime(),
  );
});
