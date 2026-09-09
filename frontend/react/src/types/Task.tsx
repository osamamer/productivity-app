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
    taskSeriesId: string | null;
    seriesOccurrenceAt: string | null;
    skipped: boolean;
}
