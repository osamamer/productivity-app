import assert from 'node:assert/strict';
import test from 'node:test';
import { unlockBoundaries, boundariesUnlockRemaining, clearBoundariesSession } from '../src/lib/boundariesSession.ts';

test('Boundaries stays authorized across navigation for ten minutes without extending on reads', () => {
  clearBoundariesSession();
  assert.equal(boundariesUnlockRemaining(1000), 0);
  unlockBoundaries(1000);
  assert.equal(boundariesUnlockRemaining(1000), 600_000);
  assert.equal(boundariesUnlockRemaining(301_000), 300_000);
  assert.equal(boundariesUnlockRemaining(601_000), 0);
  assert.equal(boundariesUnlockRemaining(700_000), 0);
});

test('clearing an account session revokes Boundaries authorization', () => {
  unlockBoundaries(1000);
  clearBoundariesSession();
  assert.equal(boundariesUnlockRemaining(1001), 0);
});
