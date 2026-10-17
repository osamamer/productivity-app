import type { Task, TaskSeries } from '@/types/models';

export interface TaskDetailsCacheEntry {
  task: Task;
  subtasks: Task[];
  taskSeries: TaskSeries | null;
}

const TASK_DETAILS_TTL_MS = 60 * 60 * 1000;
const MAX_TASK_DETAILS_ENTRIES = 500;
const MAX_CONCURRENT_DETAIL_LOADS = 4;

const entries = new Map<string, { details: TaskDetailsCacheEntry; expiresAt: number }>();
const pendingLoads = new Map<string, Promise<TaskDetailsCacheEntry>>();
const detailLoadWaiters: Array<() => void> = [];
let availableDetailLoadSlots = MAX_CONCURRENT_DETAIL_LOADS;
let cacheGeneration = 0;

async function withDetailLoadSlot<T>(loader: () => Promise<T>): Promise<T> {
  if (availableDetailLoadSlots === 0) {
    await new Promise<void>(resolve => detailLoadWaiters.push(resolve));
  } else {
    availableDetailLoadSlots -= 1;
  }

  try {
    return await loader();
  } finally {
    const nextWaiter = detailLoadWaiters.shift();
    if (nextWaiter) nextWaiter();
    else availableDetailLoadSlots += 1;
  }
}

function setEntry(taskId: string, details: TaskDetailsCacheEntry): void {
  entries.delete(taskId);
  entries.set(taskId, { details, expiresAt: Date.now() + TASK_DETAILS_TTL_MS });
  while (entries.size > MAX_TASK_DETAILS_ENTRIES) {
    const oldestTaskId = entries.keys().next().value;
    if (!oldestTaskId) break;
    entries.delete(oldestTaskId);
  }
}

export function getCachedTaskDetails(taskId: string): TaskDetailsCacheEntry | undefined {
  const cached = entries.get(taskId);
  if (!cached) return undefined;
  entries.delete(taskId);
  entries.set(taskId, cached);
  return cached.details;
}

export function getFreshTaskDetails(taskId: string): TaskDetailsCacheEntry | undefined {
  const cached = entries.get(taskId);
  return cached && cached.expiresAt > Date.now() ? getCachedTaskDetails(taskId) : undefined;
}

export function setCachedTaskDetails(taskId: string, details: TaskDetailsCacheEntry): void {
  setEntry(taskId, details);
}

export function setCachedTaskSeries(taskId: string, taskSeries: TaskSeries): void {
  const details = getCachedTaskDetails(taskId);
  if (!details) return;
  setEntry(taskId, {
    ...details,
    task: { ...details.task, taskSeriesId: taskSeries.seriesId },
    taskSeries,
  });
}

export function updateCachedTaskSeries(taskSeries: TaskSeries): void {
  [...entries.entries()].forEach(([taskId, cached]) => {
    if (cached.details.task.taskSeriesId !== taskSeries.seriesId) return;
    setEntry(taskId, {
      ...cached.details,
      task: { ...cached.details.task, importance: taskSeries.importance },
      taskSeries,
    });
  });
}

export function markCachedTaskSeriesInactive(seriesId: string): void {
  [...entries.entries()].forEach(([taskId, cached]) => {
    if (cached.details.taskSeries?.seriesId !== seriesId) return;
    setEntry(taskId, {
      ...cached.details,
      taskSeries: { ...cached.details.taskSeries, active: false },
    });
  });
}

export function loadTaskDetails(
  taskId: string,
  loader: () => Promise<TaskDetailsCacheEntry>,
): Promise<TaskDetailsCacheEntry> {
  const fresh = getFreshTaskDetails(taskId);
  if (fresh) return Promise.resolve(fresh);

  const pending = pendingLoads.get(taskId);
  if (pending) return pending;

  const generation = cacheGeneration;
  const request = withDetailLoadSlot(() => {
    if (generation !== cacheGeneration) throw new Error('Task details request belongs to a previous session');
    return loader();
  }).then(details => {
    if (generation === cacheGeneration) setEntry(taskId, details);
    return details;
  }).finally(() => {
    if (pendingLoads.get(taskId) === request) pendingLoads.delete(taskId);
  });
  pendingLoads.set(taskId, request);
  return request;
}

export function updateCachedTask(task: Task): void {
  const ownDetails = getCachedTaskDetails(task.taskId);
  if (ownDetails) setEntry(task.taskId, { ...ownDetails, task });

  [...entries.entries()].forEach(([taskId, cached]) => {
    const subtaskIndex = cached.details.subtasks.findIndex(subtask => subtask.taskId === task.taskId);
    if (subtaskIndex < 0) return;
    const subtasks = [...cached.details.subtasks];
    subtasks[subtaskIndex] = task;
    setEntry(taskId, { ...cached.details, subtasks });
  });
}

export function addCachedSubtask(parentTaskId: string, subtask: Task): void {
  const details = getCachedTaskDetails(parentTaskId);
  if (!details || details.subtasks.some(item => item.taskId === subtask.taskId)) return;
  setEntry(parentTaskId, { ...details, subtasks: [...details.subtasks, subtask] });
}

export function removeCachedTask(taskId: string): void {
  const details = getCachedTaskDetails(taskId);
  entries.delete(taskId);
  details?.subtasks.forEach(subtask => entries.delete(subtask.taskId));
  [...entries.entries()].forEach(([parentTaskId, cached]) => {
    const subtasks = cached.details.subtasks.filter(subtask => subtask.taskId !== taskId);
    if (subtasks.length !== cached.details.subtasks.length) {
      setEntry(parentTaskId, { ...cached.details, subtasks });
    }
  });
}

export function clearTaskDetailsCache(): void {
  cacheGeneration += 1;
  entries.clear();
  pendingLoads.clear();
}
