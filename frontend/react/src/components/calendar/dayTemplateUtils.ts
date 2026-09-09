import { addDays, format, startOfDay } from 'date-fns';
import { CalendarEvent } from '../../types/CalendarEvent';
import { DayTemplateRequest } from '../../types/DayTemplate';
import { Task } from '../../types/Task';
import { expandCalendarEvent } from './recurrence';

function timeInZone(value: string, timeZone: string): string {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(new Date(value));
        const get = (type: string) => parts.find(part => part.type === type)?.value ?? '00';
        return `${get('hour')}:${get('minute')}:${get('second')}`;
    } catch {
        const date = new Date(value);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
    }
}

function taskTime(value: string): string {
    const date = new Date(value);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function taskDate(value: string): string {
    // Keep this aligned with the month calendar's task event date calculation.
    return new Date(value).toISOString().slice(0, 10);
}

function eventsForDate(events: CalendarEvent[], sourceDate: string) {
    if (!sourceDate) return [];

    const dayStart = startOfDay(new Date(`${sourceDate}T12:00:00`));
    const dayEnd = startOfDay(addDays(dayStart, 1));

    return events.flatMap(event => expandCalendarEvent(event, dayStart, dayEnd)
        .filter(occurrence => occurrence.allDay
            ? occurrence.occurrenceDate <= sourceDate && sourceDate < occurrence.end
            : occurrence.occurrenceDate === sourceDate)
        .map(occurrence => ({
            title: event.title,
            description: event.description ?? '',
            allDay: occurrence.allDay,
            startTime: occurrence.allDay ? null : timeInZone(occurrence.start, event.timeZone || 'UTC'),
            endTime: occurrence.allDay ? null : timeInZone(occurrence.end, event.timeZone || 'UTC'),
            timeZone: event.timeZone || 'UTC',
            reminderMinutesBefore: event.reminderMinutesBefore,
            status: event.status,
        })));
}

export function buildDayTemplateRequest(
    name: string,
    sourceDate: string,
    events: CalendarEvent[],
    tasks: Task[],
): DayTemplateRequest {
    return {
        name: name.trim(),
        events: eventsForDate(events, sourceDate),
        tasks: tasks
            .filter(task => task.scheduledPerformDateTime && taskDate(task.scheduledPerformDateTime) === sourceDate)
            .map(task => ({
                name: task.name,
                description: task.description ?? '',
                scheduledTime: task.scheduledPerformDateTime ? taskTime(task.scheduledPerformDateTime) : null,
                tag: task.tag || null,
                importance: task.importance,
            })),
    };
}

export function formatTemplateDate(date: string): string {
    if (!date) return '';
    return format(new Date(`${date}T12:00:00`), 'MMMM d, yyyy');
}
