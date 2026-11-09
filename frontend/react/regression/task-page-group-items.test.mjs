import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let buildTaskListItems;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ buildTaskListItems } = await viteServer.ssrLoadModule('/src/components/task-page/taskPageSectionUtils.ts'));
});

after(async () => {
  await viteServer?.close();
});

test('shows the only visible open task on its own after the rest of its group is completed', () => {
  const tasks = [{ taskId: 'remaining-task' }];
  const groups = [{
    groupId: 'group-1',
    name: 'Project tasks',
    taskIds: ['completed-task', 'remaining-task'],
    displayOrder: 0,
  }];

  assert.deepEqual(buildTaskListItems(tasks, groups), [{ kind: 'task', task: tasks[0] }]);
});

test('keeps a group together while more than one of its tasks is visible', () => {
  const tasks = [{ taskId: 'task-1' }, { taskId: 'task-2' }];
  const groups = [{
    groupId: 'group-1',
    name: 'Project tasks',
    taskIds: ['task-1', 'task-2'],
    displayOrder: 0,
  }];

  assert.deepEqual(buildTaskListItems(tasks, groups), [{ kind: 'group', group: groups[0], tasks }]);
});
