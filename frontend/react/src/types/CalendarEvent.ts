export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type RecurrenceUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type CalendarEventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
export type CalendarEventReminderScope = 'EVENT' | 'SERIES';

export type CalendarEventOccurrenceOverride = {
    occurrenceKey: string;
    status: CalendarEventStatus;
    deleted: boolean;
    startDate?: string | null;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
};

export type CalendarEvent = {
    id: string;
    calendarId: string;
    title: string;
    description: string;
    allDay: boolean;
    startDate: string | null;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
    status: CalendarEventStatus;
    recurrenceFrequency: RecurrenceFrequency;
    recurrenceEndDate: string | null;
    recurrenceInterval: number | null;
    recurrenceUnit: RecurrenceUnit | null;
    cancelledOccurrenceKeys: string[];
    occurrenceOverrides: CalendarEventOccurrenceOverride[];
    reminderMinutesBefore: number | null;
    createdAt: string;
    updatedAt: string;
    sourceId?: string | null;
    // Set when the event is a chunk of planned time for an activity.
    activityId?: string | null;
    // Set when the event is a focus block planned for a task.
    taskId?: string | null;
};

export type CalendarEventFutureDeletionResponse = {
    eventDeleted: boolean;
    event: CalendarEvent | null;
};

export type CalendarEventInput = {
    calendarId?: string;
    // Omit to leave an existing event's activity alone; null removes it.
    activityId?: string | null;
    // Omit to leave an existing event's task alone; null removes it.
    taskId?: string | null;
    title: string;
    description: string;
    allDay: boolean;
    startDate: string | null;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
    status: CalendarEventStatus;
    recurrenceFrequency: RecurrenceFrequency;
    recurrenceEndDate: string | null;
    recurrenceInterval: number | null;
    recurrenceUnit: RecurrenceUnit | null;
    reminderMinutesBefore: number | null;
};

export type CalendarEventOccurrenceMoveInput = Pick<
    CalendarEventInput,
    'startDate' | 'endDate' | 'startTime' | 'endTime'
>;
