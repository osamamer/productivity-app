import assert from 'node:assert/strict';
import test from 'node:test';
import { appColor, buildPlannedLane, buildScreenLane, hourTicks, slotAt } from '../src/components/day/dayTimelineLayout.ts';

const MIN = 60_000;
const at = minutes => Date.UTC(2026, 10, 18, 8) + minutes * MIN;
const nameOf = appId => appId.toUpperCase();
const segment = (appId, from, to, title = null) => ({ appId, start: at(from), end: at(to), title });

test('blocks are placed as percentages of the day window', () => {
  const lane = buildScreenLane({ segments: [segment('firefox', 0, 60)], tracked: [{ start: at(0), end: at(120) }], nameOf }, at(0), at(120), at(120));
  const [app, away] = lane.blocks;
  assert.equal(app.kind, 'app');
  assert.deepEqual([app.leftPct, app.widthPct], [0, 50]);
  assert.deepEqual([away.kind, away.leftPct, away.widthPct], ['away', 50, 50]);
});

test('a gap while tracking ran is "away"; a gap while it did not is "not tracked"', () => {
  const lane = buildScreenLane({ segments: [segment('firefox', 30, 60)], tracked: [{ start: at(20), end: at(90) }], nameOf }, at(0), at(90), at(90));
  assert.deepEqual(lane.blocks.map(block => block.kind), ['untracked', 'away', 'app', 'away']);
});

test('the lane stops at now, because later time has not happened yet', () => {
  const lane = buildScreenLane({ segments: [segment('firefox', 0, 30)], tracked: [{ start: at(0), end: at(30) }], nameOf }, at(0), at(600), at(30));
  assert.equal(lane.blocks.at(-1).end, at(30));
});

test('consecutive segments of one app (tab or document switches) form one block with its top titles', () => {
  const lane = buildScreenLane({
    segments: [segment('firefox', 0, 10, 'Docs'), segment('firefox', 10, 40, 'Video'), segment('firefox', 40, 45, 'Docs')],
    tracked: [{ start: at(0), end: at(45) }],
    nameOf,
  }, at(0), at(45), at(45));
  assert.equal(lane.blocks.length, 1);
  assert.deepEqual(lane.blocks[0].titles, ['Video', 'Docs']);
});

test('a burst of short visits to several apps becomes one "switching" block', () => {
  const seconds = s => Date.UTC(2026, 10, 18, 8) + s * 1000;
  const segments = [
    { appId: 'firefox', start: seconds(0), end: seconds(20), title: null },
    { appId: 'discord', start: seconds(20), end: seconds(50), title: null },
    { appId: 'firefox', start: seconds(50), end: seconds(70), title: null },
  ];
  const lane = buildScreenLane({ segments, tracked: [{ start: seconds(0), end: seconds(70) }], nameOf }, seconds(0), seconds(70), seconds(70));
  assert.equal(lane.blocks.length, 1);
  assert.equal(lane.blocks[0].kind, 'switching');
  assert.deepEqual(lane.blocks[0].apps.map(app => [app.appId, app.ms]), [['firefox', 40_000], ['discord', 30_000]]);
});

test('many visits of a few minutes each, back to back, read as one switching block', () => {
  const apps = ['code', 'firefox', 'discord', 'code', 'firefox', 'discord'];
  const segments = apps.map((appId, index) => segment(appId, index * 3, index * 3 + 3));
  const lane = buildScreenLane({ segments, tracked: [{ start: at(0), end: at(18) }], nameOf }, at(0), at(18), at(18));
  assert.deepEqual(lane.blocks.map(block => block.kind), ['switching']);
  assert.equal(lane.blocks[0].apps.reduce((total, app) => total + app.ms, 0), 18 * MIN);
});

test('a single short visit between long ones stays an app block', () => {
  const lane = buildScreenLane({
    segments: [segment('code', 0, 30), { appId: 'discord', start: at(30), end: at(30) + 20_000, title: null }, segment('code', 31, 60)],
    tracked: [{ start: at(0), end: at(60) }],
    nameOf,
  }, at(0), at(60), at(60));
  assert.deepEqual(lane.blocks.filter(block => block.kind !== 'away').map(block => block.kind === 'app' && block.appId), ['code', 'discord', 'code']);
});

test('totals count only active app time inside the window, largest first', () => {
  const lane = buildScreenLane({
    segments: [segment('code', -30, 30), segment('firefox', 40, 50), segment('code', 50, 60)],
    tracked: [{ start: at(-30), end: at(60) }],
    nameOf,
  }, at(0), at(60), at(60));
  assert.deepEqual(lane.appTimes.map(app => [app.appId, app.ms / MIN]), [['code', 40], ['firefox', 10]]);
  assert.equal(lane.totalMs, 50 * MIN);
});

test('an app keeps the same colour every day', () => {
  assert.equal(appColor('firefox'), appColor('firefox'));
  assert.match(appColor('org.kde.dolphin'), /^#[0-9a-f]{6}$/);
});

test('overlapping planned items go on separate rows; later ones reuse free rows', () => {
  const lane = buildPlannedLane([
    { id: 'a', kind: 'event', title: 'Standup', start: at(0), end: at(30) },
    { id: 'b', kind: 'focus', title: 'Thesis', start: at(10), end: at(50) },
    { id: 'c', kind: 'event', title: 'Lunch', start: at(30), end: at(60) },
  ], at(0), at(120));
  assert.deepEqual(lane.map(block => [block.id, block.row]), [['a', 0], ['b', 1], ['c', 0]]);
});

test('hour ticks fall on whole hours inside the window', () => {
  const start = new Date(2026, 10, 18, 7, 30).getTime();
  const end = new Date(2026, 10, 18, 10, 0).getTime();
  assert.deepEqual(hourTicks(start, end).map(tick => new Date(tick).getHours()), [8, 9, 10]);
});

test('only blocks that overlap share the width; a block on its own gets all of it', () => {
  const item = (id, from, to) => ({ id, kind: 'event', title: id, start: at(from), end: at(to) });
  const lane = buildPlannedLane([item('deep', 0, 180), item('focus', 30, 90), item('lunch', 210, 255)], at(0), at(600));
  assert.deepEqual(lane.map(block => [block.id, block.row, block.columns]), [['deep', 0, 2], ['focus', 1, 2], ['lunch', 0, 1]]);
});

test('a chain of overlaps counts as one group, even when its ends do not touch', () => {
  const item = (id, from, to) => ({ id, kind: 'event', title: id, start: at(from), end: at(to) });
  const lane = buildPlannedLane([item('a', 0, 60), item('b', 30, 120), item('c', 90, 150)], at(0), at(600));
  assert.deepEqual(lane.map(block => [block.id, block.row, block.columns]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 2]]);
});

test('a click becomes an hour-long slot starting on the half hour before it', () => {
  const slot = slotAt(at(0), at(600), 95 / 600);
  assert.deepEqual([slot.start, slot.end], [at(90), at(150)]);
});

test('a slot clicked near the end of the day is pulled back inside the window', () => {
  const slot = slotAt(at(0), at(600), 0.99);
  assert.deepEqual([slot.start, slot.end], [at(540), at(600)]);
});
