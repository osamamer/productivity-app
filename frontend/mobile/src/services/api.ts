import { appConfig } from '@/lib/config';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import type {
  ApplicationNotification,
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
  StatEntry,
  StatGroup,
  StatSummary,
  Task,
  TaskGroup,
  TaskInput,
  UserPreferences,
} from '@/types/models';
import { resolveAccessToken } from './auth-session';

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

export const api = {
  tasks: {
    all: () => apiRequest<Task[]>('/api/v1/tasks/main'),
    today: () => apiRequest<Task[]>('/api/v1/tasks/today'),
    past: () => apiRequest<Task[]>('/api/v1/tasks?period=PAST'),
    future: () => apiRequest<Task[]>('/api/v1/tasks?period=FUTURE'),
    create: (input: TaskInput) => json<Task>('/api/v1/tasks', 'POST', input),
    update: (id: string, updates: Partial<Task>) =>
      json<Task>(`/api/v1/tasks/${id}`, 'PATCH', updates),
    remove: (id: string) => apiRequest<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),
    reorder: (taskIds: string[]) => json<Task[]>('/api/v1/tasks/order', 'PUT', { taskIds }),
  },
  taskGroups: {
    all: () => apiRequest<TaskGroup[]>('/api/v1/task-groups'),
    create: (name: string, taskIds: string[]) =>
      json<TaskGroup>('/api/v1/task-groups', 'POST', { name, taskIds }),
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
    end: (taskId: string) => apiRequest<void>(`/api/v1/pomodoro/end/${taskId}`, { method: 'POST' }),
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
    history: () => apiRequest<MentalStateCheckIn[]>('/api/v1/mental-state/check-ins?limit=30'),
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
  },
  notes: {
    all: () => apiRequest<Note[]>('/api/v1/notes'),
    get: (id: string) => apiRequest<Note>(`/api/v1/notes/${id}`),
    categories: () => apiRequest<NoteCategory[]>('/api/v1/note-categories'),
    create: (categoryId: string | null = null) =>
      json<Note>('/api/v1/notes', 'POST', {
        title: 'Untitled',
        content: '',
        categoryId,
        pinned: false,
      }),
    update: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'categoryId' | 'pinned'>>) =>
      json<Note>(`/api/v1/notes/${id}`, 'PATCH', updates),
    remove: (id: string) => apiRequest<void>(`/api/v1/notes/${id}`, { method: 'DELETE' }),
  },
  stats: {
    definitions: () => apiRequest<StatDefinition[]>('/api/v1/stats/definitions'),
    groups: () => apiRequest<StatGroup[]>('/api/v1/stats/groups'),
    today: () => apiRequest<StatEntry[]>('/api/v1/stats/entries/today'),
    entries: (statDefinitionId: string, from: string, to: string) => {
      const params = new URLSearchParams({ statDefinitionId, from, to });
      return apiRequest<StatEntry[]>(`/api/v1/stats/entries?${params}`);
    },
    entriesByDate: (date: string) => apiRequest<StatEntry[]>(`/api/v1/stats/entries/by-date?date=${encodeURIComponent(date)}`),
    record: (statDefinitionId: string, value: number, date?: string) =>
      json<StatEntry>('/api/v1/stats/entries', 'POST', { statDefinitionId, value, date }),
    create: (input: Pick<StatDefinition, 'name' | 'description' | 'type' | 'minValue' | 'maxValue'>) =>
      json<StatDefinition>('/api/v1/stats/definitions', 'POST', input),
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
    end: (id: string, moodAfter: number) =>
      json<MeditationSession>(`/api/v1/meditation/${id}/end`, 'POST', { moodAfter }),
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
    due: () => apiRequest<ApplicationNotification[]>('/api/v1/notifications/due'),
    acknowledge: (id: string) =>
      json<void>(`/api/v1/notifications/${id}/acknowledge`, 'POST'),
  },
};
