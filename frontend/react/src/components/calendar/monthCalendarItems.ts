import { StatDefinition, StatEntry } from "../../types/Stats.ts";
import { formatDurationValue, formatTimeValue } from "../../services/utils/statValues.ts";
import { format, subDays } from "date-fns";
import { CalendarEvent, CalendarEventInput, CalendarEventOccurrenceMoveInput } from "../../types/CalendarEvent.ts";
import { statNumericValueLabel } from '../stats/statVisualization';

export const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

export function priorityBucket(importance: number): number {
    if (importance > 7) return 9;
    if (importance > 4) return 6;
    return 3;
}

export function calendarEventTextColor(hexColor: string): string {
    const normalized = hexColor.replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#ffffff';
    const channels = [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map(channel => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    const whiteContrast = 1.05 / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / (0.014 + 0.05);
    return darkContrast > whiteContrast ? '#18202a' : '#ffffff';
}

export function statEventValue(definition: StatDefinition, value: number, status?: StatEntry['status']): string {
    if (status === 'NOT_PLANNED') return 'Not planned';
    if (definition.type === 'BOOLEAN') return value === 1 ? 'Yes' : 'No';
    if (definition.type === 'TIME') return formatTimeValue(value);
    if (definition.type === 'DURATION') return formatDurationValue(value);
    return statNumericValueLabel(value, definition.type === 'NUMBER' ? definition.unit : null);
}

export function calendarEventTimeLabel(start: Date | null): string {
    if (!start) return '';
    return format(start, start.getMinutes() === 0 ? 'h a' : 'h:mm a');
}

export function taskDateTimeOnDate(scheduledDateTime: string, date: Date): string | null {
    const time = /T(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)/.exec(scheduledDateTime)?.[1];
    if (!time || Number.isNaN(date.getTime())) return null;

    return `${format(date, 'yyyy-MM-dd')}T${time.length === 5 ? `${time}:00` : time}`;
}

export function calendarEventMoveInput(
    allDay: boolean,
    start: Date | null,
    end: Date | null,
): CalendarEventOccurrenceMoveInput | null {
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    if (allDay) {
        return {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(subDays(end, 1), 'yyyy-MM-dd'),
            startTime: null,
            endTime: null,
        };
    }

    return {
        startDate: null,
        endDate: null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
    };
}

export function calendarEventInputWithMove(
    event: CalendarEvent,
    move: CalendarEventOccurrenceMoveInput,
): CalendarEventInput {
    return {
        title: event.title,
        description: event.description,
        allDay: event.allDay,
        ...move,
        timeZone: event.timeZone,
        status: event.status,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceEndDate: event.recurrenceEndDate,
        recurrenceInterval: event.recurrenceInterval,
        recurrenceUnit: event.recurrenceUnit,
        reminderMinutesBefore: event.reminderMinutesBefore,
    };
}

export function importedEventReminderStart(event: CalendarEvent): string | null {
    if (!event.allDay) return event.startTime;
    if (!event.startDate) return null;

    const [year, month, day] = event.startDate.split('-').map(Number);
    const localMidnightAsUtc = Date.UTC(year, month - 1, day);
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: event.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        });
        let instant = localMidnightAsUtc;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const parts = Object.fromEntries(formatter.formatToParts(instant)
                .filter(part => part.type !== 'literal')
                .map(part => [part.type, Number(part.value)]));
            const renderedAsUtc = Date.UTC(
                parts.year, parts.month - 1, parts.day,
                parts.hour, parts.minute, parts.second,
            );
            instant = localMidnightAsUtc - (renderedAsUtc - instant);
        }
        return new Date(instant).toISOString();
    } catch (error) {
        console.warn('Could not resolve imported event time zone for reminder picker:', error);
        return new Date(`${event.startDate}T00:00:00`).toISOString();
    }
}

export function isImportedEventPast(event: CalendarEvent, now = new Date()): boolean {
    if (!event.allDay) {
        const end = event.endTime ?? event.startTime;
        return end != null && new Date(end).getTime() <= now.getTime();
    }

    const endDate = event.endDate ?? event.startDate;
    if (!endDate) return false;

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: event.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(now);
        const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));
        const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
        return endDate < today;
    } catch (error) {
        console.warn('Could not resolve imported event time zone:', error);
        return endDate < format(now, 'yyyy-MM-dd');
    }
}
