import { appConfig } from '@/lib/config';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import type {
  CalendarEvent,
  CalendarEventInput,
  Day,
  MeditationSession,
  MentalStateCheckIn,
  MentalStateRequest,
  MentalThread,
  MentalThreadInput,
  MentalThreadSummary,
  Note,
  NoteCategory,
  PomodoroConfig,
  PomodoroStatus,
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
  UserPreferences,
} from '@/types/models';
import { resolveAccessToken } from './auth-session';
import { invalidateResource } from '@/lib/resourceInvalidation';

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

function taskPeriodPath(period: 'PAST' | 'FUTURE', limit?: number, offset = 0): string {
  const params = new URLSearchParams({ period });
  if (limit !== undefined) {
    params.set('limit', String(limit));
    params.set('offset', String(offset));
  }
  return `/api/v1/tasks?${params.toString()}`;
}

export const api = {
  tasks: {
    all: () => apiRequest<Task[]>('/api/v1/tasks/main'),
    scheduled: () => apiRequest<Task[]>('/api/v1/tasks?scheduled=true'),
    today: () => apiRequest<Task[]>('/api/v1/tasks/today'),
    past: (limit?: number, offset = 0) => apiRequest<Task[]>(taskPeriodPath('PAST', limit, offset)),
    future: (limit?: number, offset = 0) => apiRequest<Task[]>(taskPeriodPath('FUTURE', limit, offset)),
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
      if (series.statLinked) invalidateResource('stats');
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
      if (updated.statLinked) invalidateResource('stats');
      return updated;
    },
    stopRecurrence: (seriesId: string) => apiRequest<void>(`/api/v1/task-series/${seriesId}`, { method: 'DELETE' }),
    update: async (id: string, updates: Partial<Task>) => {
      const updated = await json<Task>(`/api/v1/tasks/${id}`, 'PATCH', updates);
      if (updates.completed !== undefined || updates.scheduledPerformDateTime !== undefined) {
        invalidateResource('tasks');
        if (updated.statLinked) invalidateResource('stats');
      }
      return updated;
    },
    subtasks: (taskId: string) => apiRequest<Task[]>(`/api/v1/tasks/${taskId}/subtasks`),
    createSubtask: (taskId: string, input: Omit<TaskInput, 'parentId'>) =>
      json<Task>(`/api/v1/tasks/${taskId}/subtasks`, 'POST', {
        ...input,
        timeZone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      }),
    remove: (id: string) => apiRequest<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),
    removeOccurrence: (id: string) => apiRequest<void>(`/api/v1/tasks/${id}/occurrence`, { method: 'DELETE' }),
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
  pomodoro: {
    config: () => apiRequest<PomodoroConfig>('/api/v1/pomodoro/config'),
    start: (taskId: string, input: {
      focusDuration: number;
      shortBreakDuration: number;
      longBreakDuration: number;
      numFocuses: number;
      longBreakCooldown: number;
      secondsMode: boolean;
    }) => json<void>('/api/v1/pomodoro/start', 'POST', { taskId, ...input }),
    end: (taskId: string) => apiRequest<PomodoroStatus>(`/api/v1/pomodoro/end/${taskId}`, { method: 'POST' }),
    startNextPhase: (taskId: string) => apiRequest<void>(`/api/v1/pomodoro/phase/start/${taskId}`, { method: 'POST' }),
    finishBreakEarly: (taskId: string) => apiRequest<void>(`/api/v1/pomodoro/phase/finish-break/${taskId}`, { method: 'POST' }),
    statusForTask: (taskId: string) => apiRequest<PomodoroStatus | undefined>(`/api/v1/pomodoro/status/${taskId}`),
    status: () => apiRequest<PomodoroStatus | undefined>('/api/v1/pomodoro/status'),
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
    createGroup: (name: string, statDefinitionIds: string[] = []) =>
      json<StatGroup>('/api/v1/stats/groups', 'POST', { name, statDefinitionIds }),
    renameGroup: (groupId: string, name: string) =>
      json<StatGroup>(`/api/v1/stats/groups/${groupId}`, 'PATCH', { name }),
    replaceGroupDefinitions: (groupId: string, statDefinitionIds: string[]) =>
      json<StatGroup>(`/api/v1/stats/groups/${groupId}/definitions`, 'PUT', { statDefinitionIds }),
    removeGroup: (groupId: string) =>
      apiRequest<void>(`/api/v1/stats/groups/${groupId}`, { method: 'DELETE' }),
    today: () => apiRequest<StatEntry[]>('/api/v1/stats/entries/today'),
    entries: (statDefinitionId: string, from: string, to: string) => {
      const params = new URLSearchParams({ statDefinitionId, from, to });
      return apiRequest<StatEntry[]>(`/api/v1/stats/entries?${params}`);
    },
    entriesByDate: (date: string) => apiRequest<StatEntry[]>(`/api/v1/stats/entries/by-date?date=${encodeURIComponent(date)}`),
    record: async (statDefinitionId: string, value: number | null, date?: string, status?: StatEntryStatus) => {
      const entry = await json<StatEntry | undefined>('/api/v1/stats/entries', 'POST', { statDefinitionId, value, date, status });
      invalidateResource('stats');
      return entry;
    },
    create: (input: Pick<StatDefinition, 'name' | 'description' | 'type' | 'minValue' | 'maxValue'> & { morality?: StatMorality | null; goodThreshold?: number | null }) =>
      json<StatDefinition>('/api/v1/stats/definitions', 'POST', input),
    update: (id: string, input: Pick<StatDefinition, 'name' | 'description' | 'morality' | 'goodThreshold'>) =>
      json<StatDefinition>(`/api/v1/stats/definitions/${id}`, 'PUT', input),
    summary: (id: string, from: string, to: string) =>
      apiRequest<StatSummary>(`/api/v1/stats/definitions/${id}/summary?from=${from}&to=${to}`),
  },
  meditation: {
    active: () => apiRequest<MeditationSession | undefined>('/api/v1/meditation/active'),
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
