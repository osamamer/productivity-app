import { CalendarEvent, CalendarEventStatus } from './CalendarEvent';
import { Task } from './Task';

export type DayTemplateEventRequest = {
    title: string;
    description: string;
    allDay: boolean;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
    reminderMinutesBefore: number | null;
    status: CalendarEventStatus;
};

export type DayTemplateTaskRequest = {
    name: string;
    description: string;
    scheduledTime: string | null;
    tag: string | null;
    importance: number;
};

export type DayTemplateRequest = {
    name: string;
    events: DayTemplateEventRequest[];
    tasks: DayTemplateTaskRequest[];
};

export type DayTemplateEvent = DayTemplateEventRequest & {
    id: string;
    displayOrder: number;
};

export type DayTemplateTask = DayTemplateTaskRequest & {
    id: string;
    displayOrder: number;
};

export type DayTemplate = {
    id: string;
    name: string;
    events: DayTemplateEvent[];
    tasks: DayTemplateTask[];
    createdAt: string;
    updatedAt: string;
};

export type DayTemplateApplication = {
    templateId: string;
    templateName: string;
    date: string;
    events: CalendarEvent[];
    tasks: Task[];
};
