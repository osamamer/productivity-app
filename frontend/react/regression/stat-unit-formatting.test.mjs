import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let viteServer;
let statNumericValueLabel;
let statValueLabel;

before(async () => {
  viteServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
    logLevel: 'silent',
  });
  ({ statNumericValueLabel, statValueLabel } = await viteServer.ssrLoadModule('/src/components/stats/statVisualization.ts'));
});

after(async () => {
  await viteServer?.close();
});

test('numeric amount labels include the configured unit in primary and companion inputs', () => {
  assert.equal(statNumericValueLabel(1250, 'steps'), '1.3k steps');
  assert.equal(statValueLabel({ type: 'NUMBER', unit: 'kg' }, 2.5), '2.5 kg');
  assert.equal(statValueLabel({ type: 'BOOLEAN', unit: 'cups' }, 4, 'NUMBER'), '4 cups');
  assert.equal(statValueLabel({ type: 'NUMBER' }, 4), '4');
});
