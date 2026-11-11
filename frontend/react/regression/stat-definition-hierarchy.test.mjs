import assert from 'node:assert/strict';
import test from 'node:test';
import { groupStatDefinitions, includeDirectStatChildren, topLevelStatDefinitions } from '../src/services/utils/statDefinitionHierarchy.ts';

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

test('calendar check-in groups sub-stat inputs inside their parent', () => {
  const definitions = [
    { id: 'exercise' },
    { id: 'walk', parentDefinitionId: 'exercise' },
    { id: 'sleep' },
  ];

  assert.deepEqual(groupStatDefinitions(definitions), [
    { definition: definitions[0], subDefinitions: [definitions[1]] },
    { definition: definitions[2], subDefinitions: [] },
  ]);
});

test('a sub-stat remains editable on its own when its parent is not selected', () => {
  const definitions = [{ id: 'walk', parentDefinitionId: 'exercise' }];

  assert.deepEqual(groupStatDefinitions(definitions), [
    { definition: definitions[0], subDefinitions: [] },
  ]);
});

test('the stat list shows parent stats but not their sub-stats', () => {
  const definitions = [
    { id: 'exercise' },
    { id: 'walk', parentDefinitionId: 'exercise' },
    { id: 'orphan', parentDefinitionId: 'missing-parent' },
  ];

  assert.deepEqual(topLevelStatDefinitions(definitions), [definitions[0], definitions[2]]);
});
