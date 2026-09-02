export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type RecurrenceUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

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
    recurrenceFrequency: RecurrenceFrequency;
    recurrenceEndDate: string | null;
    recurrenceInterval: number | null;
    recurrenceUnit: RecurrenceUnit | null;
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
    recurrenceFrequency: RecurrenceFrequency;
    recurrenceEndDate: string | null;
    recurrenceInterval: number | null;
    recurrenceUnit: RecurrenceUnit | null;
    reminderMinutesBefore: number | null;
};
