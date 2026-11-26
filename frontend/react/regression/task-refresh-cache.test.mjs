import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const storage = new Map();
const sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
before(async () => {
  globalThis.window = { sessionStorage, localStorage: sessionStorage };
  server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', server: { middlewareMode: true, ws: false, watch: null }, logLevel: 'silent' });
});
after(async () => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  await server?.close();
});

for (const kind of ['tasks', 'groups']) {
  test(`a late ${kind} response cannot overwrite the persisted forced refresh`, async () => {
    storage.clear();
    const service = kind === 'tasks'
      ? (await server.ssrLoadModule('/src/services/api/taskService.ts')).taskService
      : (await server.ssrLoadModule('/src/services/api/taskGroupService.ts')).taskGroupService;
    const load = () => kind === 'tasks' ? service.getAllMainTasks(true) : service.getGroups(true);
    const cached = () => kind === 'tasks' ? service.getCachedMainTasks() : service.getCachedGroups();
    const pending = [];
    globalThis.fetch = () => new Promise(resolve => pending.push(resolve));
    const older = [{ name: 'before', taskId: '1', groupId: '1', completed: false }];
    const newer = [{ ...older[0], name: 'after', completed: true }];
    const first = load();
    const second = load();
    assert.equal(pending.length, 2, 'a forced load replaces the stalled request');
    pending[1](new Response(JSON.stringify(newer)));
    await second;
    pending[0](new Response(JSON.stringify(older)));
    await first;
    assert.deepEqual(cached(), newer);
    const snapshot = [...storage.values()].map(value => JSON.parse(value)).find(value => kind === 'tasks' ? value.tasks : value.groups);
    assert.deepEqual(kind === 'tasks' ? snapshot.tasks : snapshot.groups, newer);
  });
}

test('day timeline blocks retain event and recurrence identity for editing', async () => {
  const { plannedItems } = await server.ssrLoadModule('/src/components/day/plannedItems.ts');
  const { buildPlannedLane } = await server.ssrLoadModule('/src/components/day/dayTimelineLayout.ts');
  const start = new Date('2026-11-26T00:00:00Z');
  const end = new Date('2026-11-27T00:00:00Z');
  const event = { id: 'focus-event', title: 'Focus', taskId: 'task-1', allDay: false, startTime: '2026-11-25T09:00:00Z', endTime: '2026-11-25T10:00:00Z', timeZone: 'UTC', status: 'CONFIRMED', recurrenceFrequency: 'DAILY', recurrenceEndDate: null, cancelledOccurrenceKeys: [], occurrenceOverrides: [] };
  const blocks = buildPlannedLane(plannedItems({ events: [event] }, start, end), start.getTime(), end.getTime());
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].eventId, event.id);
  assert.equal(blocks[0].occurrenceKey, 'instant:2026-11-26T09:00:00.000Z');
  assert.equal(blocks[0].kind, 'focus');
});
