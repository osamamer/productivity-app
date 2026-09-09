import { TaskRecurrenceFrequency, TaskRecurrenceUnit } from './TaskRecurrence';

export type TaskSeries = {
    seriesId: string;
    name: string;
    description: string | null;
    tag: string | null;
    importance: number;
    mentalThreadId: string | null;
    startDateTime: string;
    recurrenceFrequency: Exclude<TaskRecurrenceFrequency, 'NONE'>;
    recurrenceEndDate: string | null;
    recurrenceInterval: number | null;
    recurrenceUnit: TaskRecurrenceUnit | null;
    timeZone: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};
