import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let isCalendarStatTaskVisible;
let isCalendarDailyTaskVisible;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ isCalendarStatTaskVisible, isCalendarDailyTaskVisible } = await viteServer.ssrLoadModule('/src/services/utils/calendarStatTaskVisibility.ts'));
});

after(async () => {
  await viteServer?.close();
});

function task(overrides = {}) {
  return {
    taskId: 'task-1',
    name: 'Meditate',
    linkedStatDefinitionId: null,
    taskSeriesId: null,
    statLinked: false,
    ...overrides,
  };
}

function definition(id, overrides = {}) {
  return {
    id,
    name: id,
    focusTaskName: null,
    focusTaskNames: [],
    recurringTaskSeriesId: null,
    ...overrides,
  };
}

test('hides stat-linked tasks globally without hiding regular tasks', () => {
  const definitions = [definition('meditation')];

  assert.equal(isCalendarStatTaskVisible(task({ linkedStatDefinitionId: 'meditation' }), definitions, new Set(['meditation']), false), false);
  assert.equal(isCalendarStatTaskVisible(task({ name: 'Write report' }), definitions, new Set(), false), true);
});

test('filters direct and recurring links by the selected statistic', () => {
  const definitions = [
    definition('weekly-review', { recurringTaskSeriesId: 'series-1' }),
    definition('daily-journal'),
  ];

  assert.equal(isCalendarStatTaskVisible(task({ linkedStatDefinitionId: 'daily-journal' }), definitions, new Set(['weekly-review']), true), false);
  assert.equal(isCalendarStatTaskVisible(task({ taskSeriesId: 'series-1' }), definitions, new Set(['weekly-review']), true), true);
});

test('matches legacy focus task names case-insensitively and allows any selected link', () => {
  const definitions = [
    definition('meditation', { focusTaskNames: ['Meditate'] }),
    definition('quiet-time', { focusTaskName: 'MEDITATE' }),
  ];

  assert.equal(isCalendarStatTaskVisible(task(), definitions, new Set(['quiet-time']), true), true);
  assert.equal(isCalendarStatTaskVisible(task(), definitions, new Set(['other']), true), false);
});

test('does not infer recurring stat links from task names and handles orphaned stat links safely', () => {
  const definitions = [definition('weekly', { recurringTaskSeriesId: 'series-1', focusTaskName: 'Meditate' })];

  assert.equal(isCalendarStatTaskVisible(task(), definitions, new Set(['weekly']), true), true);
  assert.equal(isCalendarStatTaskVisible(task({ statLinked: true }), [], new Set(), true), true);
  assert.equal(isCalendarStatTaskVisible(task({ statLinked: true }), [], new Set(), false), false);
});

test('daily task visibility is independent from stat links', () => {
  assert.equal(isCalendarDailyTaskVisible(task({ recurrenceFrequency: 'DAILY', statLinked: true }), false), false);
  assert.equal(isCalendarDailyTaskVisible(task({ recurrenceFrequency: 'DAILY' }), true), true);
  assert.equal(isCalendarDailyTaskVisible(task({ recurrenceFrequency: 'WEEKLY' }), false), true);
  assert.equal(isCalendarDailyTaskVisible(task(), false), true);
});
