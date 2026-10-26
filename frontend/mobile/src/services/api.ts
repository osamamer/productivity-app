import { appConfig } from '@/lib/config';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import type {
  CalendarEvent,
  CalendarEventFutureDeletionResponse,
  CalendarEventInput,
  Calendar,
  CalendarSource,
  CalendarInput,
  CalendarUpdate,
  Day,
  MeditationSession,
  MentalStateCheckIn,
  MentalStateRequest,
  MentalThread,
  MentalThreadInput,
  MentalThreadSummary,
  Note,
  NoteCategory,
  StatDefinition,
  StatMorality,
  StatEntryStatus,
  StatEntry,
  StatGroup,
  StatSummary,
  Task,
  TaskGroup,
  TaskInput,
  TaskRecurrenceFrequency,
  TaskSeries,
  TodayFocusSummary,
  UserPreferences,
} from '@/types/models';
import { resolveAccessToken } from './auth-session';
import { invalidateResource } from '@/lib/resourceInvalidation';
import {
  addCachedSubtask,
  getFreshTaskDetails,
  loadTaskDetails,
  markCachedTaskSeriesInactive,
  removeCachedTask,
  setCachedTaskSeries,
  setCachedTaskDetails,
  updateCachedTask,
  updateCachedTaskSeries,
} from '@/lib/taskDetailsCache';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

function errorMessage(body: string, status: number): string {
  if (!body) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? body;
  } catch {
    return body;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const perform = async (forceRefresh: boolean) => {
    const token = await resolveAccessToken(forceRefresh);
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');

    return fetch(`${appConfig.apiUrl}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };

  let response = await perform(false);
  if (response.status === 401) response = await perform(true);
  if (!response.ok) {
    const body = await response.text();
    const detail = errorMessage(body, response.status);
    console.error('API request failed:', { path, status: response.status }, new Error(detail));
    throw new Error(GENERIC_ERROR_MESSAGE);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

const json = <T>(path: string, method: string, body?: unknown) =>
  apiRequest<T>(path, { method, body });

export const TASK_PAGE_BATCH_SIZE = 30;

type CalendarResponsePayload = Omit<Calendar, 'isDefault'> & {
  isDefault?: boolean;
  defaultCalendar?: boolean;
};

function normalizeCalendar(calendar: CalendarResponsePayload): Calendar {
  const { defaultCalendar, isDefault, ...rest } = calendar;
  return { ...rest, isDefault: isDefault ?? defaultCalendar ?? false };
}

function taskPeriodPath(period: 'PAST' | 'FUTURE', limit?: number, offset = 0, completed?: boolean): string {
  const params = new URLSearchParams({ period });
  if (limit !== undefined) {
    params.set('limit', String(limit));
    params.set('offset', String(offset));
  }
  if (completed !== undefined) params.set('completed', String(completed));
  return `/api/v1/tasks?${params.toString()}`;
}

export const api = {
  calendars: {
    all: async () => (await apiRequest<CalendarResponsePayload[]>('/api/v1/calendars')).map(normalizeCalendar),
    create: async (input: CalendarInput) => normalizeCalendar(await json<CalendarResponsePayload>('/api/v1/calendars', 'POST', input)),
    update: async (id: string, input: CalendarUpdate) => normalizeCalendar(await json<CalendarResponsePayload>(`/api/v1/calendars/${id}`, 'PATCH', input)),
    remove: (id: string) => apiRequest<void>(`/api/v1/calendars/${id}`, { method: 'DELETE' }),
  },
  calendarSources: {
    all: () => apiRequest<CalendarSource[]>('/api/v1/calendar-sources'),
    subscribe: (name: string, color: Calendar['color'], url: string) =>
      json<CalendarSource>('/api/v1/calendar-sources/url', 'POST', { name, color, url }),
    sync: (sourceId: string) =>
      json<CalendarSource>(`/api/v1/calendar-sources/${sourceId}/sync`, 'POST'),
    upload: async (name: string, color: Calendar['color'], file: { uri: string; name: string; mimeType?: string }) => {
      const form = new FormData();
      form.append('name', name);
      form.append('color', color);
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'text/calendar' } as unknown as Blob);
      const token = await resolveAccessToken(false);
      const response = await fetch(`${appConfig.apiUrl}/api/v1/calendar-sources/file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!response.ok) {
        console.error('Calendar upload failed:', { status: response.status });
        throw new Error(GENERIC_ERROR_MESSAGE);
      }
      return response.json() as Promise<CalendarSource>;
    },
  },
  tasks: {
    all: () => apiRequest<Task[]>('/api/v1/tasks/main'),
    scheduled: () => apiRequest<Task[]>('/api/v1/tasks?scheduled=true'),
    today: () => apiRequest<Task[]>('/api/v1/tasks/today'),
    focusToday: (date: string) => apiRequest<TodayFocusSummary>(`/api/v1/tasks/focus-today?date=${encodeURIComponent(date)}`),
    past: (limit?: number, offset = 0, completed?: boolean) => apiRequest<Task[]>(taskPeriodPath('PAST', limit, offset, completed)),
    future: (limit?: number, offset = 0, completed?: boolean) => apiRequest<Task[]>(taskPeriodPath('FUTURE', limit, offset, completed)),
    undated: () => apiRequest<Task[]>('/api/v1/tasks/undated'),
    create: (input: TaskInput) => json<Task>('/api/v1/tasks', 'POST', {
      ...input,
      timeZone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    }),
    recurrence: (taskId: string) => apiRequest<TaskSeries | undefined>(`/api/v1/tasks/${taskId}/recurrence`),
    startRecurrence: async (taskId: string, recurrence: {
      recurrenceFrequency: Exclude<TaskRecurrenceFrequency, 'NONE'>;
      recurrenceEndDate: string | null;
      recurrenceInterval: number | null;
      recurrenceUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
      timeZone: string;
    }) => {
      const series = await json<TaskSeries>(`/api/v1/tasks/${taskId}/recurrence`, 'POST', recurrence);
      setCachedTaskSeries(taskId, series);
      if (series.statLinked) invalidateResource('stats', 'task');
      return series;
    },
    updateRecurrence: async (seriesId: string, recurrence: {
      recurrenceFrequency: Exclude<TaskRecurrenceFrequency, 'NONE'>;
      recurrenceEndDate: string | null;
      recurrenceInterval: number | null;
      recurrenceUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
      timeZone: string;
      active?: boolean;
    }) => {
      const updated = await json<TaskSeries>(`/api/v1/task-series/${seriesId}`, 'PATCH', recurrence);
      updateCachedTaskSeries(updated);
      if (updated.statLinked) invalidateResource('stats', 'task');
      return updated;
    },
    updateRecurrenceImportance: async (seriesId: string, importance: number) => {
      const updated = await json<TaskSeries>(`/api/v1/task-series/${seriesId}/importance`, 'PATCH', { importance });
      updateCachedTaskSeries(updated);
      invalidateResource('tasks');
      return updated;
    },
    stopRecurrence: async (seriesId: string) => {
      await apiRequest<void>(`/api/v1/task-series/${seriesId}`, { method: 'DELETE' });
      markCachedTaskSeriesInactive(seriesId);
    },
    update: async (id: string, updates: Partial<Task>) => {
      const updated = await json<Task>(`/api/v1/tasks/${id}`, 'PATCH', updates);
      updateCachedTask(updated);
      if (updates.completed !== undefined || updates.scheduledPerformDateTime !== undefined) {
        invalidateResource('tasks');
        if (updated.statLinked) invalidateResource('stats', 'task');
      }
      return updated;
    },
    subtasks: (taskId: string) => apiRequest<Task[]>(`/api/v1/tasks/${taskId}/subtasks`),
    details: async (task: Task) => {
      const fresh = getFreshTaskDetails(task.taskId);
      if (fresh) {
        if (fresh.task !== task) {
          const updated = { ...fresh, task };
          setCachedTaskDetails(task.taskId, updated);
          return updated;
        }
        return fresh;
      }

      const details = await loadTaskDetails(task.taskId, async () => {
        const [subtasks, taskSeries] = await Promise.all([
          apiRequest<Task[]>(`/api/v1/tasks/${task.taskId}/subtasks`),
          task.taskSeriesId
            ? apiRequest<TaskSeries | undefined>(`/api/v1/tasks/${task.taskId}/recurrence`)
            : Promise.resolve(null),
        ]);
        return { task, subtasks, taskSeries: taskSeries ?? null };
      });
      if (details.task !== task) {
        const updated = { ...details, task };
        setCachedTaskDetails(task.taskId, updated);
        return updated;
      }
      return details;
    },
    createSubtask: async (taskId: string, input: Omit<TaskInput, 'parentId'>) => {
      const created = await json<Task>(`/api/v1/tasks/${taskId}/subtasks`, 'POST', {
        ...input,
        timeZone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      });
      addCachedSubtask(taskId, created);
      return created;
    },
    remove: async (id: string) => {
      await apiRequest<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' });
      removeCachedTask(id);
    },
    removeOccurrence: async (id: string) => {
      await apiRequest<void>(`/api/v1/tasks/${id}/occurrence`, { method: 'DELETE' });
      removeCachedTask(id);
    },
    removeFutureOccurrences: async (id: string) => {
      await apiRequest<void>(`/api/v1/tasks/${id}/future-occurrences`, { method: 'DELETE' });
    },
    reorder: (taskIds: string[]) => json<Task[]>('/api/v1/tasks/order', 'PUT', { taskIds }),
  },
  taskGroups: {
    all: () => apiRequest<TaskGroup[]>('/api/v1/task-groups'),
    create: (name: string, taskIds: string[]) =>
      json<TaskGroup>('/api/v1/task-groups', 'POST', { name, taskIds }),
    rename: (groupId: string, name: string) =>
      json<TaskGroup>(`/api/v1/task-groups/${groupId}`, 'PATCH', { name }),
    replaceTasks: (groupId: string, taskIds: string[]) =>
      json<TaskGroup>(`/api/v1/task-groups/${groupId}/tasks`, 'PUT', { taskIds }),
    remove: (groupId: string) => apiRequest<void>(`/api/v1/task-groups/${groupId}`, { method: 'DELETE' }),
  },
  session: {
    pause: (taskId: string) => apiRequest<void>(`/api/v1/session/pause/${taskId}`, { method: 'POST' }),
    resume: (taskId: string) => apiRequest<void>(`/api/v1/session/unpause/${taskId}`, { method: 'POST' }),
  },
  day: {
    today: () => apiRequest<Day>('/api/v1/day/get-today'),
    save: (rating: number, plan: string, summary: string) =>
      json<void>('/api/v1/day/set-today-info', 'POST', {
        dayRating: rating,
        dayPlan: plan,
        daySummary: summary,
      }),
  },
  mentalThreads: {
    all: (includeClosed = false) =>
      apiRequest<MentalThread[]>(`/api/v1/mental-threads?includeClosed=${includeClosed}`),
    summary: () => apiRequest<MentalThreadSummary>('/api/v1/mental-threads/summary'),
    create: (input: MentalThreadInput) =>
      json<MentalThread>('/api/v1/mental-threads', 'POST', input),
    update: (id: string, input: MentalThreadInput) =>
      json<MentalThread>(`/api/v1/mental-threads/${id}`, 'PUT', input),
    close: (id: string, closureType: string, resolutionSummary: string | null) =>
      json<MentalThread>(`/api/v1/mental-threads/${id}/close`, 'POST', {
        closureType,
        resolutionSummary,
      }),
    reopen: (id: string) =>
      json<MentalThread>(`/api/v1/mental-threads/${id}/reopen`, 'POST'),
    capacity: (capacity: number) =>
      json<void>('/api/v1/mental-threads/capacity/today', 'PUT', { capacity }),
  },
  mentalState: {
    history: (limit = 5) => apiRequest<MentalStateCheckIn[]>(`/api/v1/mental-state/check-ins?limit=${limit}`),
    checkIn: (input: MentalStateRequest) =>
      json<MentalStateCheckIn>('/api/v1/mental-state/check-ins', 'POST', input),
  },
  events: {
    all: () => apiRequest<CalendarEvent[]>('/api/v1/events'),
    create: (input: CalendarEventInput) =>
      json<CalendarEvent>('/api/v1/events', 'POST', input),
    update: (id: string, input: CalendarEventInput) =>
      json<CalendarEvent>(`/api/v1/events/${id}`, 'PUT', input),
    remove: (id: string) => apiRequest<void>(`/api/v1/events/${id}`, { method: 'DELETE' }),
    cancelOccurrence: (id: string, occurrenceKey: string) =>
      json<CalendarEvent>(`/api/v1/events/${id}/occurrences/cancel`, 'POST', { occurrenceKey }),
    updateOccurrenceStatus: (id: string, occurrenceKey: string, status: CalendarEvent['status']) =>
      json<CalendarEvent>(`/api/v1/events/${id}/occurrences/status`, 'POST', { occurrenceKey, status }),
    deleteOccurrence: (id: string, occurrenceKey: string) =>
      json<CalendarEvent>(`/api/v1/events/${id}/occurrences`, 'DELETE', { occurrenceKey }),
    deleteFutureOccurrences: (id: string, occurrenceKey: string) =>
      json<CalendarEventFutureDeletionResponse>(`/api/v1/events/${id}/occurrences/future`, 'DELETE', { occurrenceKey }),
    restoreOccurrence: (id: string, occurrenceKey: string) =>
      apiRequest<CalendarEvent>(`/api/v1/events/${id}/occurrences/cancel?occurrenceKey=${encodeURIComponent(occurrenceKey)}`, { method: 'DELETE' }),
  },
  notes: {
    all: () => apiRequest<Note[]>('/api/v1/notes'),
    get: (id: string) => apiRequest<Note>(`/api/v1/notes/${id}`),
    categories: () => apiRequest<NoteCategory[]>('/api/v1/note-categories'),
    create: (categoryId: string | null = null) =>
      json<Note>('/api/v1/notes', 'POST', {
        title: '',
        content: '',
        categoryId,
        pinned: false,
      }),
    update: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'categoryId' | 'pinned'>>) =>
      json<Note>(`/api/v1/notes/${id}`, 'PATCH', updates),
    remove: (id: string) => apiRequest<void>(`/api/v1/notes/${id}`, { method: 'DELETE' }),
    bulkUpdate: (noteIds: string[], updates: Partial<Pick<Note, 'categoryId' | 'pinned'>>) =>
      json<Note[]>('/api/v1/notes/bulk', 'PATCH', { noteIds, ...updates }),
    bulkRemove: (noteIds: string[]) =>
      json<void>('/api/v1/notes/bulk', 'DELETE', { noteIds }),
  },
  stats: {
    definitions: () => apiRequest<StatDefinition[]>('/api/v1/stats/definitions'),
    groups: () => apiRequest<StatGroup[]>('/api/v1/stats/groups'),
    createGroup: async (name: string, statDefinitionIds: string[] = []) => {
      const group = await json<StatGroup>('/api/v1/stats/groups', 'POST', { name, statDefinitionIds });
      invalidateResource('stats', 'stat-group');
      return group;
    },
    renameGroup: async (groupId: string, name: string) => {
      const group = await json<StatGroup>(`/api/v1/stats/groups/${groupId}`, 'PATCH', { name });
      invalidateResource('stats', 'stat-group');
      return group;
    },
    replaceGroupDefinitions: async (groupId: string, statDefinitionIds: string[]) => {
      const group = await json<StatGroup>(`/api/v1/stats/groups/${groupId}/definitions`, 'PUT', { statDefinitionIds });
      invalidateResource('stats', 'stat-group');
      return group;
    },
    removeGroup: async (groupId: string) => {
      await apiRequest<void>(`/api/v1/stats/groups/${groupId}`, { method: 'DELETE' });
      invalidateResource('stats', 'stat-group');
    },
    today: () => apiRequest<StatEntry[]>('/api/v1/stats/entries/today'),
    entries: (statDefinitionId: string, from: string, to: string) => {
      const params = new URLSearchParams({ statDefinitionId, from, to });
      return apiRequest<StatEntry[]>(`/api/v1/stats/entries?${params}`);
    },
    entriesByDate: (date: string) => apiRequest<StatEntry[]>(`/api/v1/stats/entries/by-date?date=${encodeURIComponent(date)}`),
    record: async (statDefinitionId: string, value: number | null, date?: string, status?: StatEntryStatus) => {
      const entry = await json<StatEntry | undefined>('/api/v1/stats/entries', 'POST', { statDefinitionId, value, date, status });
      invalidateResource('stats', 'stat');
      return entry;
    },
    create: async (input: Pick<StatDefinition, 'name' | 'type' | 'minValue' | 'maxValue'> & { morality?: StatMorality | null; goodThreshold?: number | null }) => {
      const definition = await json<StatDefinition>('/api/v1/stats/definitions', 'POST', input);
      invalidateResource('stats', 'stat-definition');
      return definition;
    },
    update: async (id: string, input: Pick<StatDefinition, 'name' | 'morality' | 'goodThreshold'>) => {
      const definition = await json<StatDefinition>(`/api/v1/stats/definitions/${id}`, 'PUT', input);
      invalidateResource('stats', 'stat-definition');
      return definition;
    },
    summary: (id: string, from: string, to: string) =>
      apiRequest<StatSummary>(`/api/v1/stats/definitions/${id}/summary?from=${from}&to=${to}`),
  },
  meditation: {
    active: () => apiRequest<MeditationSession | undefined>('/api/v1/meditation/active'),
    get: (id: string) => apiRequest<MeditationSession | undefined>(`/api/v1/meditation/${id}`),
    start: (mood: number, intendedLength: number, numIntervalBells = 0) =>
      json<MeditationSession>('/api/v1/meditation/start', 'POST', {
        mood,
        intendedLength,
        numIntervalBells,
      }),
    pause: (id: string) => json<MeditationSession>(`/api/v1/meditation/${id}/pause`, 'PATCH'),
    resume: (id: string) => json<MeditationSession>(`/api/v1/meditation/${id}/unpause`, 'PATCH'),
    end: (id: string, moodAfter?: number) =>
      json<MeditationSession>(`/api/v1/meditation/${id}/end`, 'POST', moodAfter === undefined ? undefined : { moodAfter }),
    discard: (id: string) => apiRequest<void>(`/api/v1/meditation/${id}`, { method: 'DELETE' }),
  },
  preferences: {
    get: () => apiRequest<UserPreferences>('/api/v1/users/me/preferences'),
    update: (updates: Partial<UserPreferences>) =>
      json<UserPreferences>('/api/v1/users/me/preferences', 'PATCH', updates),
  },
  account: {
    changePassword: (currentPassword: string, newPassword: string) =>
      json<void>('/api/v1/users/me/password', 'PUT', { currentPassword, newPassword }),
  },
  notifications: {
    acknowledge: (id: string) =>
      json<void>(`/api/v1/notifications/${id}/acknowledge`, 'POST'),
    registerPushToken: (token: string) =>
      json<void>('/api/v1/notifications/push-token', 'POST', { token }),
    removePushTokens: () =>
      apiRequest<void>('/api/v1/notifications/push-token', { method: 'DELETE' }),
  },
};
