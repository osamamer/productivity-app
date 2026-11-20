import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let didItems;
let plannedItems;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ didItems } = await viteServer.ssrLoadModule('/src/components/day/didItems.ts'));
  ({ plannedItems } = await viteServer.ssrLoadModule('/src/components/day/plannedItems.ts'));
});

after(async () => {
  await viteServer?.close();
});

const H = 3_600_000;
const day = Date.UTC(2026, 10, 18);
const at = hours => new Date(day + hours * H).toISOString();
const focus = (id, from, to) => ({ id, taskId: 't', taskName: 'Write', pomodoro: true, startTime: at(from), endTime: to === null ? null : at(to), durationSeconds: 0 });

test('actual focus sessions belong to the Did lane, not the plan', () => {
  const overview = { events: [], focusSessions: [focus('a', 9, 10)] };
  assert.deepEqual(plannedItems(overview, new Date(day), new Date(day + 24 * H), []), []);
  const did = didItems([], [], day + 12 * H, overview.focusSessions);
  assert.deepEqual(did.map(item => [item.kind, item.title, item.start - day, item.end - day]), [['focus', 'Write', 9 * H, 10 * H]]);
});

test('a focus session still running reaches to now in the Did lane', () => {
  const did = didItems([], [], day + 11 * H, [focus('b', 10, null)]);
  assert.equal(did[0].end, day + 11 * H);
});
