import type { TaskRecurrenceDraft } from './TaskRecurrence';
import type { TaskPomodoroStats } from './TaskPomodoroStats';

export interface Task   {
    taskId: string;
    name: string;
    description: string;
    completed: boolean;
    creationDateTime: string;
    creationDate: string;
    scheduledPerformDateTime: string | null;
    timeZone?: string;
    reminderMinutesBefore?: number | null;
    completionDateTime: string;
    parentId: string;
    tag: string;
    importance: number;
    displayOrder: number;
    mentalThreadId: string | null;
    projectId: string | null;
    taskSeriesId: string | null;
    calendarId?: string;
    linkedStatDefinitionId?: string | null;
    seriesOccurrenceAt: string | null;
    skipped: boolean;
    statLinked?: boolean;
    focusHistory?: TaskPomodoroStats;
    optimisticRecurrence?: TaskRecurrenceDraft;
}

export type TaskUpdate = Partial<Task> & {
    calendarScope?: 'occurrence' | 'series';
};
