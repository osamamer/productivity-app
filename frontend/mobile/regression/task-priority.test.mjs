import assert from 'node:assert/strict';
import test from 'node:test';
import {
  taskPriorityColor,
  taskPriorityLabel,
  taskPriorityValue,
} from '../src/lib/taskPriority.ts';

test('uses stable low, medium, and high thresholds at boundary values', () => {
  assert.deepEqual(
    [3, 4, 5, 7, 8, 10].map(taskPriorityLabel),
    ['Low', 'Low', 'Medium', 'Medium', 'High', 'High'],
  );
});

test('maps arbitrary importance scores to the three task-editor values and colors', () => {
  assert.deepEqual(
    [4, 6, 9].map(importance => ({
      value: taskPriorityValue(importance),
      color: taskPriorityColor(importance),
    })),
    [
      { value: 3, color: '#1976d2' },
      { value: 6, color: '#eab308' },
      { value: 9, color: '#ef4444' },
    ],
  );
});
