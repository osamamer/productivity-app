import {
    StatRecurrenceDay, StatRecurringTaskDraft, StatWeeklyTaskScheduleDraft,
} from '../../types/Stats';

export const STAT_RECURRENCE_DAYS: { value: StatRecurrenceDay; label: string }[] = [
    { value: 'SUNDAY', label: 'S' },
    { value: 'MONDAY', label: 'M' },
    { value: 'TUESDAY', label: 'T' },
    { value: 'WEDNESDAY', label: 'W' },
    { value: 'THURSDAY', label: 'T' },
    { value: 'FRIDAY', label: 'F' },
    { value: 'SATURDAY', label: 'S' },
];

function todayDay(): StatRecurrenceDay {
    return STAT_RECURRENCE_DAYS[new Date().getDay()].value;
}

function currentTimeOfDay(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function upcomingTimeOfDay(): string {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5);
    return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
}

export function timeOfDayFromDateTime(value: string): string {
    return /T(\d{2}:\d{2})/.exec(value)?.[1] ?? currentTimeOfDay();
}

export function defaultStatRecurringTaskDraft(): StatRecurringTaskDraft {
    return {
        recurrenceFrequency: 'DAILY',
        recurrenceDaysOfWeek: [todayDay()],
        timeOfDay: currentTimeOfDay(),
        importance: 3,
    };
}

export function defaultStatWeeklyTaskScheduleDraft(taskName = ''): StatWeeklyTaskScheduleDraft {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5);
    return {
        taskName,
        daysOfWeek: [STAT_RECURRENCE_DAYS[next.getDay()].value],
        timeOfDay: upcomingTimeOfDay(),
        importance: 3,
        weekStartDate: currentWeekStartDate(),
        weekCount: 1,
    };
}

export function currentWeekStartDate(): string {
    const today = new Date();
    today.setDate(today.getDate() - today.getDay());
    return formatDateOnly(today);
}

export function normalizeStatWeekStartDate(date: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    const [year, month, day] = date.split('-').map(Number);
    const selected = new Date(year, month - 1, day);
    if (selected.getFullYear() !== year || selected.getMonth() !== month - 1 || selected.getDate() !== day) {
        return '';
    }
    selected.setDate(selected.getDate() - selected.getDay());
    return formatDateOnly(selected);
}

function formatDateOnly(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isStatScheduleDayAvailable(
    day: StatRecurrenceDay,
    timeOfDay: string,
    weekStartDate = currentWeekStartDate(),
): boolean {
    const currentWeekStart = currentWeekStartDate();
    if (weekStartDate > currentWeekStart) return true;
    if (weekStartDate < currentWeekStart) return false;
    const dayIndex = STAT_RECURRENCE_DAYS.findIndex(option => option.value === day);
    const now = new Date();
    if (dayIndex < now.getDay()) return false;
    if (dayIndex > now.getDay()) return true;
    if (!/^\d{2}:\d{2}$/.test(timeOfDay)) return true;
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return new Date(`${date}T${timeOfDay}:00`).getTime() > now.getTime();
}
