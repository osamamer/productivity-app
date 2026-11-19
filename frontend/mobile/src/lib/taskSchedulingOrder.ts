import type { Task } from '@/types/models';

function scheduledTime(task: Task): number {
  const time = task.scheduledPerformDateTime ? Date.parse(task.scheduledPerformDateTime) : Number.POSITIVE_INFINITY;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** Soonest scheduled first; undated tasks last; ties broken by id so the order is stable. */
export function compareNearestFirst(first: Task, second: Task): number {
  const difference = scheduledTime(first) - scheduledTime(second);
  return difference !== 0 ? difference : first.taskId.localeCompare(second.taskId);
}

export function compareMostRecentFirst(first: Task, second: Task): number {
  return compareNearestFirst(second, first);
}
