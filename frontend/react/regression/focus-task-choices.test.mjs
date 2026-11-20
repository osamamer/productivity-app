import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let rankFocusTaskChoices;
let scheduleLabel;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ rankFocusTaskChoices, scheduleLabel } = await viteServer.ssrLoadModule('/src/components/calendar/day-view/focusTaskChoices.ts'));
});

after(async () => {
  await viteServer?.close();
});

const chunkStart = new Date('2026-11-20T17:00:00');
const task = (taskId, overrides = {}) => ({
  taskId, name: taskId, importance: 0, scheduledPerformDateTime: null, taskSeriesId: null, ...overrides,
});
const ids = tasks => tasks.map(t => t.taskId);

test('tasks scheduled on the chunk day come before more important tasks on other days', () => {
  const tasks = [
    task('urgent-tomorrow', { importance: 10, scheduledPerformDateTime: '2026-11-21T09:00:00' }),
    task('plain-today', { scheduledPerformDateTime: '2026-11-20T08:00:00' }),
  ];
  assert.deepEqual(ids(rankFocusTaskChoices(tasks, '', chunkStart)), ['plain-today', 'urgent-tomorrow']);
});

test('within the day, higher priority wins, then the schedule closest to the chunk', () => {
  const tasks = [
    task('low-at-five', { scheduledPerformDateTime: '2026-11-20T17:00:00' }),
    task('high-morning', { importance: 9, scheduledPerformDateTime: '2026-11-20T08:00:00' }),
    task('high-afternoon', { importance: 9, scheduledPerformDateTime: '2026-11-20T16:00:00' }),
  ];
  assert.deepEqual(ids(rankFocusTaskChoices(tasks, '', chunkStart)), ['high-afternoon', 'high-morning', 'low-at-five']);
});

test('unscheduled tasks come after scheduled ones of the same priority', () => {
  const tasks = [task('someday'), task('next-week', { scheduledPerformDateTime: '2026-11-27T10:00:00' })];
  assert.deepEqual(ids(rankFocusTaskChoices(tasks, '', chunkStart)), ['next-week', 'someday']);
});

test('the search matches task names, ignoring case and accents', () => {
  const tasks = [task('Write report'), task('Read'), task('Réwrite intro')];
  assert.deepEqual(ids(rankFocusTaskChoices(tasks, 'WRITE', chunkStart)).sort(), ['Réwrite intro', 'Write report']);
});

test('a recurring series is listed once, by its occurrence nearest the chunk', () => {
  const tasks = [
    task('write-yesterday', { name: 'Write', taskSeriesId: 's', scheduledPerformDateTime: '2026-11-19T17:00:00' }),
    task('write-today', { name: 'Write', taskSeriesId: 's', scheduledPerformDateTime: '2026-11-20T16:00:00' }),
    task('write-tomorrow', { name: 'Write', taskSeriesId: 's', scheduledPerformDateTime: '2026-11-21T17:00:00' }),
  ];
  assert.deepEqual(ids(rankFocusTaskChoices(tasks, 'write', chunkStart)), ['write-today']);
});

test('the schedule label names nearby days and shows a time only when one is set', () => {
  const now = new Date('2026-11-20T12:00:00');
  assert.equal(scheduleLabel({ scheduledPerformDateTime: null }, now), 'Unscheduled');
  assert.equal(scheduleLabel({ scheduledPerformDateTime: '2026-11-21T00:00:00' }, now), 'Tomorrow');
  assert.equal(scheduleLabel({ scheduledPerformDateTime: '2026-11-19T00:00:00' }, now), 'Yesterday');
  assert.match(scheduleLabel({ scheduledPerformDateTime: '2026-11-20T16:00:00' }, now), /^Today 4:00/);
  assert.equal(scheduleLabel({ scheduledPerformDateTime: '2026-11-23T00:00:00' }, now), 'Mon 23 Nov');
});
