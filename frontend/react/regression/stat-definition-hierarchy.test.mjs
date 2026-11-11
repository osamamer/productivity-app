import assert from 'node:assert/strict';
import test from 'node:test';
import { includeDirectStatChildren } from '../src/services/utils/statDefinitionHierarchy.ts';

test('selecting a statistic includes its sub-stat entries in the calendar', () => {
  const definitions = [
    { id: 'exercise' },
    { id: 'walk', parentDefinitionId: 'exercise' },
    { id: 'strength', parentDefinitionId: 'exercise' },
    { id: 'sleep' },
  ];

  assert.deepEqual(includeDirectStatChildren(['exercise', 'sleep'], definitions), [
    'exercise', 'sleep', 'walk', 'strength',
  ]);
});

test('selecting a sub-stat does not implicitly select its parent or siblings', () => {
  const definitions = [
    { id: 'exercise' },
    { id: 'walk', parentDefinitionId: 'exercise' },
    { id: 'strength', parentDefinitionId: 'exercise' },
  ];

  assert.deepEqual(includeDirectStatChildren(['walk'], definitions), ['walk']);
});
