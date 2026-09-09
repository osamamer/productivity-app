import { TaskRecurrenceDay } from './TaskRecurrence';

export interface TaskToCreate   {
    name: string;
    description: string;
    scheduledPerformDateTime: string;
    reminderMinutesBefore?: number | null;
    tag: string;
    importance: number;
    parentId?: string;
    mentalThreadId?: string;
    recurrenceFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    recurrenceEndDate?: string | null;
    recurrenceInterval?: number | null;
    recurrenceUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
    recurrenceDaysOfWeek?: TaskRecurrenceDay[] | null;
    timeZone?: string;
}
