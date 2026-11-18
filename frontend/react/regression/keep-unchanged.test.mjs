import assert from 'node:assert/strict';
import test from 'node:test';
import { keepUnchanged } from '../src/services/utils/keepUnchanged.ts';

const day = () => ({ date: '2026-11-18', events: [{ id: 'a', title: 'Gym' }, { id: 'b', title: 'Lunch' }], day: { rating: 4 } });

test('a refetch with nothing new returns the very same object, so nothing re-renders', () => {
  const previous = day();
  assert.equal(keepUnchanged(previous, day()), previous);
});

test('only the edited record gets a new object; its neighbours are reused', () => {
  const previous = day();
  const next = day();
  next.events[1].title = 'Long lunch';
  const merged = keepUnchanged(previous, next);
  assert.notEqual(merged, previous);
  assert.equal(merged.events[0], previous.events[0]);
  assert.notEqual(merged.events[1], previous.events[1]);
  assert.equal(merged.day, previous.day);
});

test('records are matched by id, so an insertion keeps every existing row', () => {
  const previous = day();
  const next = day();
  next.events.unshift({ id: 'z', title: 'Walk' });
  const merged = keepUnchanged(previous, next);
  assert.equal(merged.events[1], previous.events[0]);
  assert.equal(merged.events[2], previous.events[1]);
});

test('a removal returns a shorter list that still reuses the rows that stayed', () => {
  const previous = day();
  const next = day();
  next.events.shift();
  const merged = keepUnchanged(previous, next);
  assert.deepEqual(merged.events.map(event => event.id), ['b']);
  assert.equal(merged.events[0], previous.events[1]);
});

test('added and removed fields count as changes', () => {
  const short = { a: 1 };
  assert.deepEqual(keepUnchanged(short, { a: 1, b: 2 }), { a: 1, b: 2 });
  const long = { a: 1, b: 2 };
  assert.deepEqual(keepUnchanged(long, { a: 1 }), { a: 1 });
});
