import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { localDate } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { api } from '@/services/api';
import type { Task, TaskGroup } from '@/types/models';
import { useAuth } from './AuthProvider';

type TaskWorkspaceValue = {
  allTasks: Task[];
  todayTasks: Task[];
  futureTasks: Task[];
  pastTasks: Task[];
  groups: TaskGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
  moveTask: (taskId: string, direction: 'up' | 'down') => Promise<void>;
  moveTasksToToday: (taskIds: string[]) => Promise<void>;
  createGroup: (name: string, taskIds: string[]) => Promise<TaskGroup>;
  replaceGroupTasks: (groupId: string, taskIds: string[]) => Promise<TaskGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
};

const TaskWorkspaceContext = createContext<TaskWorkspaceValue | null>(null);

function dateBucket(task: Task): 'today' | 'future' | 'past' | null {
  if (!task.scheduledPerformDateTime) return null;
  const scheduled = new Date(task.scheduledPerformDateTime);
  if (Number.isNaN(scheduled.getTime())) return null;
  const scheduledDate = localDate(scheduled);
  const today = localDate();
  if (scheduledDate === today) return 'today';
  return scheduledDate > today ? 'future' : 'past';
}

function replaceTask(tasks: Task[], updated: Task): Task[] {
  return tasks.map(task => task.taskId === updated.taskId ? updated : task);
}

export function TaskWorkspaceProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedAtRef = useRef(0);
  const requestRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    if (requestRef.current) return requestRef.current;
    if (!force && loadedAtRef.current > 0) return;

    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasks, taskGroups] = await Promise.all([api.tasks.all(), api.taskGroups.all()]);
        setAllTasks(tasks);
        setGroups(taskGroups);
        loadedAtRef.current = Date.now();
      } catch (cause) {
        console.error('Could not load mobile task workspace:', cause);
        setError(reportError('Could not load tasks', cause));
        loadedAtRef.current = 0;
      } finally {
        setLoading(false);
      }
    })();
    requestRef.current = request;
    try {
      await request;
    } finally {
      if (requestRef.current === request) requestRef.current = null;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      const resetTimer = setTimeout(() => {
        loadedAtRef.current = 0;
        setAllTasks([]);
        setGroups([]);
        setLoading(false);
        setError(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
    void load(true);
  }, [isAuthenticated, load]);

  const addTask = useCallback((task: Task) => {
    setAllTasks(previous => previous.some(item => item.taskId === task.taskId)
      ? replaceTask(previous, task)
      : [task, ...previous]);
  }, []);

  const updateTask = useCallback((task: Task) => {
    setAllTasks(previous => replaceTask(previous, task));
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setAllTasks(previous => previous.filter(task => task.taskId !== taskId));
    setGroups(previous => previous
      .map(group => ({ ...group, taskIds: group.taskIds.filter(id => id !== taskId) }))
      .filter(group => group.taskIds.length >= 2));
  }, []);

  const moveTask = useCallback(async (taskId: string, direction: 'up' | 'down') => {
    const current = allTasks.filter(task => !task.parentId);
    const index = current.findIndex(task => task.taskId === taskId);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;

    const reordered = [...current];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    const reorderedIds = reordered.map(task => task.taskId);
    setAllTasks(previous => previous.map(task => {
      const newIndex = reorderedIds.indexOf(task.taskId);
      return newIndex === -1 ? task : { ...task, displayOrder: newIndex };
    }));
    try {
      const saved = await api.tasks.reorder(reorderedIds);
      setAllTasks(previous => previous.map(task => saved.find(item => item.taskId === task.taskId) ?? task));
    } catch (cause) {
      console.error('Could not move mobile task:', cause);
      await load(true);
      throw cause;
    }
  }, [allTasks, load]);

  const moveTasksToToday = useCallback(async (taskIds: string[]) => {
    const now = new Date();
    const ids = new Set(taskIds);
    const tasksToMove = allTasks.filter(task => ids.has(task.taskId) && dateBucket(task) === 'past');
    if (tasksToMove.length === 0) return;

    const updates = tasksToMove.map(task => {
      const date = new Date(task.scheduledPerformDateTime);
      if (Number.isNaN(date.getTime())) date.setTime(now.getTime());
      date.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      const pad = (value: number) => String(value).padStart(2, '0');
      return {
        task,
        scheduledPerformDateTime: `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`,
      };
    });
    setAllTasks(previous => previous.map(task => {
      const update = updates.find(item => item.task.taskId === task.taskId);
      return update ? { ...task, scheduledPerformDateTime: update.scheduledPerformDateTime } : task;
    }));
    try {
      const saved = await Promise.all(updates.map(update => api.tasks.update(update.task.taskId, {
        scheduledPerformDateTime: update.scheduledPerformDateTime,
      })));
      saved.forEach(updateTask);
    } catch (cause) {
      console.error('Could not move mobile tasks to today:', cause);
      await load(true);
      throw cause;
    }
  }, [allTasks, load, updateTask]);

  const createGroup = useCallback(async (name: string, taskIds: string[]) => {
    const created = await api.taskGroups.create(name, taskIds);
    setGroups(previous => [
      ...previous
        .map(group => ({ ...group, taskIds: group.taskIds.filter(id => !taskIds.includes(id)) }))
        .filter(group => group.taskIds.length >= 2),
      created,
    ]);
    return created;
  }, []);

  const replaceGroupTasks = useCallback(async (groupId: string, taskIds: string[]) => {
    const updated = await api.taskGroups.replaceTasks(groupId, taskIds);
    setGroups(previous => previous.map(group => group.groupId === groupId ? updated : group));
    return updated;
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
    await api.taskGroups.remove(groupId);
    setGroups(previous => previous.filter(group => group.groupId !== groupId));
  }, []);

  const value = useMemo(() => {
    const buckets = allTasks.reduce((result, task) => {
      const bucket = dateBucket(task);
      if (bucket) result[bucket].push(task);
      return result;
    }, { today: [] as Task[], future: [] as Task[], past: [] as Task[] });
    return {
      allTasks,
      todayTasks: buckets.today,
      futureTasks: buckets.future,
      pastTasks: buckets.past,
      groups,
      loading,
      error,
      refresh: () => load(true),
      addTask,
      updateTask,
      removeTask,
      moveTask,
      moveTasksToToday,
      createGroup,
      replaceGroupTasks,
      deleteGroup,
    };
  }, [addTask, allTasks, createGroup, deleteGroup, error, groups, load, loading, moveTask, moveTasksToToday, removeTask, replaceGroupTasks, updateTask]);

  return <TaskWorkspaceContext.Provider value={value}>{children}</TaskWorkspaceContext.Provider>;
}

export function useTaskWorkspace(): TaskWorkspaceValue {
  const value = useContext(TaskWorkspaceContext);
  if (!value) throw new Error('useTaskWorkspace must be used inside TaskWorkspaceProvider');
  return value;
}
