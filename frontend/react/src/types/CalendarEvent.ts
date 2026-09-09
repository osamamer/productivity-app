export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type RecurrenceUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type CalendarEventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';

export type CalendarEventOccurrenceOverride = {
    occurrenceKey: string;
    status: CalendarEventStatus;
    deleted: boolean;
};

export type CalendarEvent = {
    id: string;
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
};

export type CalendarEventInput = {
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
