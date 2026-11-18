import assert from 'node:assert/strict';
import test from 'node:test';
import { pageTransitionKey } from '../src/components/pageTransitionKey.ts';

test('tabs and days within one page share a key, so the page is not remounted', () => {
  assert.equal(pageTransitionKey('/wellbeing/today'), pageTransitionKey('/wellbeing/report'));
  assert.equal(pageTransitionKey('/day/2026-11-17'), pageTransitionKey('/day/2026-11-18'));
});

test('different pages get different keys, so the entrance plays when moving between them', () => {
  assert.notEqual(pageTransitionKey('/wellbeing/today'), pageTransitionKey('/calendar'));
  assert.notEqual(pageTransitionKey('/'), pageTransitionKey('/tasks'));
  assert.notEqual(pageTransitionKey('/mental'), pageTransitionKey('/mental-state'));
});
