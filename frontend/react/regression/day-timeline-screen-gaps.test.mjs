import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScreenLane } from '../src/components/day/dayTimelineLayout.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const nameOf = appId => appId;

test('brief app visits hours apart do not turn screen-off time into switching', () => {
  const lane = buildScreenLane({
    segments: [
      { start: 0, end: 5 * MINUTE, appId: 'browser', title: null },
      { start: 7 * HOUR, end: 7 * HOUR + 5 * MINUTE, appId: 'chat', title: null },
    ],
    tracked: [{ start: 0, end: 5 * MINUTE }, { start: 7 * HOUR, end: 7 * HOUR + 5 * MINUTE }],
    nameOf,
  }, 0, 8 * HOUR, 8 * HOUR);

  assert.deepEqual(lane.blocks.map(({ kind, start, end }) => ({ kind, start, end })), [
    { kind: 'app', start: 0, end: 5 * MINUTE },
    { kind: 'untracked', start: 5 * MINUTE, end: 7 * HOUR },
    { kind: 'app', start: 7 * HOUR, end: 7 * HOUR + 5 * MINUTE },
    { kind: 'untracked', start: 7 * HOUR + 5 * MINUTE, end: 8 * HOUR },
  ]);
  assert.equal(lane.totalMs, 10 * MINUTE);
});

test('a tracked gap between short app visits remains away time', () => {
  const lane = buildScreenLane({
    segments: [
      { start: 0, end: MINUTE, appId: 'browser', title: null },
      { start: MINUTE + 1, end: 2 * MINUTE, appId: 'chat', title: null },
    ],
    tracked: [{ start: 0, end: 2 * MINUTE }],
    nameOf,
  }, 0, 2 * MINUTE, 2 * MINUTE);

  assert.deepEqual(lane.blocks.map(({ kind, start, end }) => ({ kind, start, end })), [
    { kind: 'app', start: 0, end: MINUTE },
    { kind: 'away', start: MINUTE, end: MINUTE + 1 },
    { kind: 'app', start: MINUTE + 1, end: 2 * MINUTE },
  ]);
});

test('contiguous brief app visits still share a switching block', () => {
  const lane = buildScreenLane({
    segments: [
      { start: 0, end: MINUTE, appId: 'browser', title: null },
      { start: MINUTE, end: 2 * MINUTE, appId: 'chat', title: null },
    ],
    tracked: [{ start: 0, end: 2 * MINUTE }],
    nameOf,
  }, 0, 2 * MINUTE, 2 * MINUTE);

  assert.equal(lane.blocks.length, 1);
  assert.equal(lane.blocks[0].kind, 'switching');
});
