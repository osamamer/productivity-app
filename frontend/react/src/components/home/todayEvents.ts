import { isNormalCalendarEvent } from '../../../../shared/calendarEventKind';
import { addDays, format } from 'date-fns';
import { expandCalendarEvent } from '../calendar/recurrence';
import { readEventTimePreferences } from '../../services/utils/inputPreferences';
import { CalendarEvent, CalendarEventInput, CalendarEventStatus } from '../../types/CalendarEvent';
import { Calendar, calendarColorHex } from '../../types/Calendar';

export type TodayEvent = {
    id: string;
    event: CalendarEvent;
    occurrenceKey: string;
    occurrenceDate: string;
    allDay: boolean;
    start: Date | null;
    end: Date | null;
    status: CalendarEventStatus;
};

export type DeleteRequest = {
    scope: 'occurrence' | 'future' | 'event';
    anchorPosition: { top: number; left: number };
};

export type BulkDeleteRequest = {
    items: TodayEvent[];
    anchorPosition: { top: number; left: number };
};

export const EVENT_STATUSES: CalendarEventStatus[] = ['CONFIRMED', 'TENTATIVE', 'CANCELLED'];
export const NEW_EVENT_STATUSES: CalendarEventStatus[] = ['CONFIRMED', 'TENTATIVE'];
export const NEW_EVENT_POPUP_CONTENT_SELECTOR = [
    '.MuiMenu-root',
    '.MuiPopover-root',
    '.MuiModal-root',
    '.MuiMenu-paper',
    '.MuiPopover-paper',
    '.MuiPickerPopper-root',
    '.MuiPickersPopper-root',
    '.MuiAutocomplete-popper',
    '.MuiPopper-root',
    '.MuiDialog-root',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="dialog"]',
].join(', ');
export const NEW_EVENT_POPUP_TRIGGER_SELECTOR = [
    '[data-calendar-chip-select="true"]',
    'button[aria-label^="Edit new event time"]',
    'button[aria-label^="Change new event status"]',
].join(', ');
export const OPTIMISTIC_EVENT_ID_PREFIX = 'home-event-optimistic-';
export const HOME_SECTION_AUTO_SCROLL_MS = 320;
let optimisticEventSequence = 0;

export function findVerticalScrollContainer(element: HTMLElement): HTMLElement | null {
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
        const overflowY = window.getComputedStyle(ancestor).overflowY;
        if (/(auto|scroll|overlay)/.test(overflowY) && ancestor.scrollHeight > ancestor.clientHeight) {
            return ancestor;
        }
        ancestor = ancestor.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
}

export function eventStatusLabel(status: CalendarEventStatus): string {
    if (status === 'TENTATIVE') return 'Tentative';
    if (status === 'CANCELLED') return 'Cancelled';
    return 'Confirmed';
}

export function eventCalendarColor(calendars: Calendar[], calendarId: string, accentColor: string): string {
    if (calendars.length === 0) return 'rgba(0, 0, 0, 0)';
    const calendar = calendars.find(candidate => candidate.id === calendarId)
        ?? calendars.find(candidate => candidate.defaultCalendar);
    return calendarColorHex(calendar?.color, accentColor);
}

export function eventsForToday(events: CalendarEvent[], dayStart: Date): TodayEvent[] {
    const dayEnd = addDays(dayStart, 1);
    const todayKey = format(dayStart, 'yyyy-MM-dd');
    const todayEvents: TodayEvent[] = [];

    events.filter(isNormalCalendarEvent).forEach(event => {
        expandCalendarEvent(event, dayStart, dayEnd).forEach(occurrence => {
            if (occurrence.allDay) {
                if (occurrence.occurrenceDate > todayKey || occurrence.end <= todayKey) return;
                todayEvents.push({
                    id: `${event.id}:${occurrence.occurrenceKey}`,
                    event,
                    occurrenceKey: occurrence.occurrenceKey,
                    occurrenceDate: occurrence.occurrenceDate,
                    allDay: true,
                    start: null,
                    end: null,
                    status: occurrence.status,
                });
                return;
            }

            const start = new Date(occurrence.start);
            const end = new Date(occurrence.end);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
                || start >= dayEnd || end <= dayStart) {
                return;
            }

            todayEvents.push({
                id: `${event.id}:${occurrence.occurrenceKey}`,
                event,
                occurrenceKey: occurrence.occurrenceKey,
                occurrenceDate: occurrence.occurrenceDate,
                allDay: false,
                start,
                end,
                status: occurrence.status,
            });
        });
    });

    return todayEvents.sort((first, second) => {
        if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
        return (first.start?.getTime() ?? 0) - (second.start?.getTime() ?? 0);
    });
}

export function sourceEventsForToday(events: CalendarEvent[], dayStart: Date): CalendarEvent[] {
    const todayEventIds = new Set(eventsForToday(events, dayStart).map(item => item.event.id));
    return events.filter(event => todayEventIds.has(event.id)
        && !event.id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX));
}

export function eventTimeLabel(event: TodayEvent, dayStart: Date): string {
    if (event.allDay) return 'All day';
    if (!event.start || !event.end) return '';

    const dayEnd = addDays(dayStart, 1);
    if (event.start < dayStart && event.end >= dayEnd) return 'Continues all day';
    if (event.start < dayStart) return `Until ${format(event.end, 'h:mm a')}`;
    if (event.end >= dayEnd) return `From ${format(event.start, 'h:mm a')} · continues`;
    const samePeriod = format(event.start, 'a') === format(event.end, 'a');
    return `${format(event.start, samePeriod ? 'h:mm' : 'h:mm a')} – ${format(event.end, 'h:mm a')}`;
}

export function eventInput(event: CalendarEvent): CalendarEventInput {
    return {
        calendarId: event.calendarId,
        title: event.title,
        description: event.description ?? '',
        allDay: event.allDay,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        timeZone: event.timeZone,
        status: event.status,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceEndDate: event.recurrenceEndDate,
        recurrenceInterval: event.recurrenceInterval,
        recurrenceUnit: event.recurrenceUnit,
        reminderMinutesBefore: event.reminderMinutesBefore,
    };
}

export function createOptimisticEvent(input: CalendarEventInput): CalendarEvent {
    const timestamp = new Date().toISOString();
    return {
        ...input,
        id: `${OPTIMISTIC_EVENT_ID_PREFIX}${Date.now()}-${++optimisticEventSequence}`,
        calendarId: input.calendarId ?? '',
        cancelledOccurrenceKeys: [],
        occurrenceOverrides: [],
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export function applyTime(value: Date, time: string): Date | null {
    if (!/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    if (hours > 23 || minutes > 59) return null;

    const result = new Date(value);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

export function oneHourAfter(time: string): string | null {
    if (!/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    if (hours > 23 || minutes > 59) return null;
    const totalMinutes = (hours * 60 + minutes + 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

export function defaultEventTimes(): { start: string; end: string } {
    const remembered = readEventTimePreferences();
    const start = remembered.startTime ?? '17:00';
    let end = remembered.endTime ?? oneHourAfter(start) ?? '18:00';
    if (end === start) end = oneHourAfter(start) ?? '18:00';
    return { start, end };
}

export function timeRangeLabel(startTime: string, endTime: string): string {
    const toDate = (time: string): Date | null => {
        if (!/^\d{2}:\d{2}$/.test(time)) return null;
        const [hours, minutes] = time.split(':').map(Number);
        if (hours > 23 || minutes > 59) return null;
        return new Date(2000, 0, 1, hours, minutes);
    };
    const start = toDate(startTime);
    const end = toDate(endTime);
    if (!start || !end) return 'Set time';
    const samePeriod = format(start, 'a') === format(end, 'a') && end >= start;
    return `${format(start, samePeriod ? 'h:mm' : 'h:mm a')} – ${format(end, 'h:mm a')}`;
}

export function eventDate(date: string | null, time: string | null, fallback: string): string {
    if (date) return date;
    return time ? format(new Date(time), 'yyyy-MM-dd') : fallback;
}

export function applyDateAndTime(date: string, time: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const result = new Date(`${date}T${time}:00`);
    return Number.isNaN(result.getTime()) ? null : result;
}
