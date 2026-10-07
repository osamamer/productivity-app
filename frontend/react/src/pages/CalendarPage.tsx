import { Alert, Box } from "@mui/material";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {MonthCalendar} from "../components/MonthCalendar.tsx";
import {useGlobalTasks} from "../hooks/useGlobalTasks";
import {useEffect, useRef, useState} from "react";
import {calendarService, dayService, dayTemplateService, eventService, taskGroupService, taskService} from "../services/api";
import {TaskToCreate} from "../types/TaskToCreate.tsx";
import {StatDefinition} from "../types/Stats.ts";
import {statService} from "../services/api/statService.ts";
import {Task, TaskUpdate} from "../types/Task.tsx";
import {TaskGroup} from "../types/TaskGroup.ts";
import {
    CalendarEvent,
    CalendarEventInput,
    CalendarEventOccurrenceMoveInput,
    CalendarEventStatus,
} from "../types/CalendarEvent.ts";
import {DayTemplate, DayTemplateApplication, DayTemplateRequest} from "../types/DayTemplate.ts";
import { playAudioFeedback } from '../services/audioFeedback';
import { useNavigate } from 'react-router-dom';
import { Calendar, CalendarColor, CalendarUpdate } from '../types/Calendar';
import { CalendarManager } from '../components/calendar/CalendarManager';

const RECURRING_TASK_LOOKBACK_DAYS = 365;
const RECURRING_TASK_HORIZON_DAYS = 90;

function formatLocalDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function nextOccurrence(current: Date, task: TaskToCreate, anchorDay: number): Date {
    const frequency = task.recurrenceFrequency;
    const interval = frequency === 'CUSTOM' ? task.recurrenceInterval ?? 1 : 1;
    const unit = frequency === 'DAILY'
        ? 'DAYS'
        : frequency === 'WEEKLY'
            ? 'WEEKS'
            : frequency === 'MONTHLY'
                ? 'MONTHS'
                : task.recurrenceUnit;
    const next = new Date(current);

    if (unit === 'DAYS') {
        next.setDate(next.getDate() + interval);
    } else if (unit === 'WEEKS') {
        next.setDate(next.getDate() + (interval * 7));
    } else {
        const targetMonth = next.getMonth() + interval;
        const targetYear = next.getFullYear() + Math.floor(targetMonth / 12);
        const normalizedMonth = ((targetMonth % 12) + 12) % 12;
        next.setFullYear(targetYear, normalizedMonth, Math.min(anchorDay, daysInMonth(targetYear, normalizedMonth)));
    }

    return next;
}

function optimisticOccurrenceDateTimes(task: TaskToCreate): string[] {
    if (!task.scheduledPerformDateTime) return [''];
    if (!task.recurrenceFrequency) return [task.scheduledPerformDateTime];

    const anchor = new Date(task.scheduledPerformDateTime);
    if (Number.isNaN(anchor.getTime())) return [task.scheduledPerformDateTime];

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - RECURRING_TASK_LOOKBACK_DAYS);
    const through = new Date(now);
    through.setDate(through.getDate() + RECURRING_TASK_HORIZON_DAYS);
    const dates: string[] = [];
    let occurrence = anchor;
    let guard = 0;

    while (occurrence <= through && guard++ < 20_000) {
        const occurrenceDate = formatLocalDateTime(occurrence).slice(0, 10);
        if (task.recurrenceEndDate && occurrenceDate > task.recurrenceEndDate) break;
        if (occurrence >= from) dates.push(formatLocalDateTime(occurrence));
        occurrence = nextOccurrence(occurrence, task, anchor.getDate());
    }

    if (!dates.includes(task.scheduledPerformDateTime)) dates.unshift(task.scheduledPerformDateTime);
    return dates;
}

function createOptimisticTasks(task: TaskToCreate, defaultCalendarId: string): Task[] {
    const optimisticSeriesId = task.recurrenceFrequency
        ? `optimistic-series-${Date.now()}-${Math.random().toString(36).slice(2)}`
        : null;
    const createdAt = formatLocalDateTime(new Date());

    return optimisticOccurrenceDateTimes(task).map((scheduledPerformDateTime, index) => ({
        taskId: `optimistic-task-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        name: task.name,
        description: task.description,
        completed: false,
        creationDateTime: createdAt,
        creationDate: createdAt.slice(0, 10),
        scheduledPerformDateTime: scheduledPerformDateTime || null,
        timeZone: task.timeZone,
        reminderMinutesBefore: task.reminderMinutesBefore,
        completionDateTime: '',
        parentId: task.parentId ?? '',
        tag: task.tag,
        importance: task.importance,
        displayOrder: index,
        mentalThreadId: task.mentalThreadId ?? null,
        projectId: task.projectId ?? null,
        taskSeriesId: optimisticSeriesId,
        calendarId: task.calendarId || defaultCalendarId,
        seriesOccurrenceAt: optimisticSeriesId ? scheduledPerformDateTime : null,
        skipped: false,
        optimisticRecurrence: task.recurrenceFrequency ? {
            recurrenceFrequency: task.recurrenceFrequency,
            recurrenceEndDate: task.recurrenceEndDate ?? null,
            recurrenceInterval: task.recurrenceInterval ?? null,
            recurrenceUnit: task.recurrenceUnit ?? null,
            timeZone: task.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        } : undefined,
    }));
}

export function CalendarPage() {
    const navigate = useNavigate();
    const {
        allTasks,
        loading: tasksLoading,
        fetchAllTasks,
        addTaskToState,
        appendTasksToState,
        removeTasksFromState,
        updateTaskInState,
    } = useGlobalTasks();

    const [statDefinitions, setStatDefinitions] = useState<StatDefinition[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [groups, setGroups] = useState<TaskGroup[]>([]);
    const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>([]);
    const [calendarDataLoading, setCalendarDataLoading] = useState(true);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [calendarSettingsLoading, setCalendarSettingsLoading] = useState(true);
    const [calendarSettingsError, setCalendarSettingsError] = useState<string | null>(null);
    const calendarMutationVersions = useRef(new Map<string, number>());
    const defaultCalendarId = calendars.find(calendar => calendar.defaultCalendar)?.id ?? '';

    useEffect(() => {
        let cancelled = false;
        calendarService.getCalendars()
            .then(accountCalendars => { if (!cancelled) setCalendars(accountCalendars); })
            .catch(error => {
                console.error('Failed to load calendars:', error);
                if (!cancelled) setCalendarSettingsError('Could not load calendars. Refresh to try again.');
            })
            .finally(() => { if (!cancelled) setCalendarSettingsLoading(false); });
        Promise.all([
            statService.getDefinitions()
                .then(definitions => { if (!cancelled) setStatDefinitions(definitions); })
                .catch(e => console.error('Failed to load stat definitions:', e)),
            eventService.getEvents()
                .then(calendarEvents => { if (!cancelled) setEvents(calendarEvents); })
                .catch(e => console.error('Failed to load calendar events:', e)),
            taskGroupService.getGroups()
                .then(taskGroups => { if (!cancelled) setGroups(taskGroups); })
                .catch(e => console.error('Failed to load task groups:', e)),
            dayTemplateService.getTemplates()
                .then(templates => { if (!cancelled) setDayTemplates(templates); })
                .catch(e => console.error('Failed to load day templates:', e)),
        ]).finally(() => {
            if (!cancelled) setCalendarDataLoading(false);
        });

        return () => { cancelled = true; };
    }, []);

    const handleUpdateCalendar = async (calendarId: string, updates: CalendarUpdate) => {
        const previous = calendars.find(calendar => calendar.id === calendarId);
        if (!previous) return;
        const version = (calendarMutationVersions.current.get(calendarId) ?? 0) + 1;
        calendarMutationVersions.current.set(calendarId, version);
        setCalendars(current => current.map(calendar => calendar.id === calendarId ? { ...calendar, ...updates } : calendar));
        try {
            const updated = await calendarService.updateCalendar(calendarId, updates);
            if (calendarMutationVersions.current.get(calendarId) === version) {
                setCalendars(current => current.map(calendar => calendar.id === calendarId ? updated : calendar));
            }
        } catch (error) {
            if (calendarMutationVersions.current.get(calendarId) === version) {
                setCalendars(current => current.map(calendar => calendar.id === calendarId ? previous : calendar));
            }
            throw error;
        }
    };

    const handleCreateCalendar = async (name: string, color: CalendarColor) => {
        const created = await calendarService.createCalendar(name, color);
        setCalendars(current => [...current, created].sort((first, second) => first.displayOrder - second.displayOrder));
    };

    const handleDeleteCalendar = async (calendarId: string) => {
        await calendarService.deleteCalendar(calendarId);
        setCalendars(current => current.filter(calendar => calendar.id !== calendarId));
    };

    const handleCreateEvent = async (input: CalendarEventInput) => {
        const created = await eventService.createEvent(input);
        setEvents(current => [...current, created]);
        playAudioFeedback('eventCreated');
    };

    const handleUpdateEvent = async (eventId: string, input: CalendarEventInput) => {
        const updated = await eventService.updateEvent(eventId, input);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleMoveEventOccurrence = async (
        eventId: string,
        occurrenceKey: string,
        move: CalendarEventOccurrenceMoveInput,
    ) => {
        const updated = await eventService.moveEventOccurrence(eventId, occurrenceKey, move);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleDeleteEvent = async (eventId: string) => {
        await eventService.deleteEvent(eventId);
        setEvents(current => current.filter(event => event.id !== eventId));
    };

    const handleCancelEventOccurrence = async (eventId: string, occurrenceKey: string) => {
        const updated = await eventService.cancelEventOccurrence(eventId, occurrenceKey);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleRestoreEventOccurrence = async (eventId: string, occurrenceKey: string) => {
        const updated = await eventService.restoreEventOccurrence(eventId, occurrenceKey);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleUpdateEventOccurrenceStatus = async (
        eventId: string,
        occurrenceKey: string,
        status: CalendarEventStatus,
    ) => {
        const updated = await eventService.updateEventOccurrenceStatus(eventId, occurrenceKey, status);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleDeleteEventOccurrence = async (eventId: string, occurrenceKey: string) => {
        const updated = await eventService.deleteEventOccurrence(eventId, occurrenceKey);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleCreateDayTemplate = async (request: DayTemplateRequest) => {
        const created = await dayTemplateService.createTemplate(request);
        setDayTemplates(current => [...current, created].sort((first, second) => first.name.localeCompare(second.name)));
    };

    const handleUpdateDayTemplate = async (templateId: string, request: DayTemplateRequest) => {
        const updated = await dayTemplateService.updateTemplate(templateId, request);
        setDayTemplates(current => current
            .map(template => template.id === templateId ? updated : template)
            .sort((first, second) => first.name.localeCompare(second.name)));
    };

    const handleDeleteDayTemplate = async (templateId: string) => {
        await dayTemplateService.deleteTemplate(templateId);
        setDayTemplates(current => current.filter(template => template.id !== templateId));
    };

    const handleApplyDayTemplate = async (templateId: string, date: string): Promise<DayTemplateApplication> => {
        const applied: DayTemplateApplication = await dayTemplateService.applyTemplate(templateId, date);
        setEvents(current => [...current, ...applied.events]);
        taskService.cacheMainTasks(applied.tasks);
        appendTasksToState(applied.tasks);
        return applied;
    };

    const handleUndoDayTemplate = async (application: DayTemplateApplication) => {
        const eventIds = new Set(application.events.map(event => event.id));
        const taskIds = application.tasks.map(task => task.taskId);

        setEvents(current => current.filter(event => !eventIds.has(event.id)));
        removeTasksFromState(taskIds);

        try {
            await Promise.all([
                ...application.events.map(event => eventService.deleteEvent(event.id)),
                ...application.tasks.map(task => taskService.deleteTaskInstance(task, { notifyResource: false })),
            ]);
            await dayService.clearAppliedTemplate(application.date);
        } catch (error) {
            console.error('Failed to undo day template application:', error);
            try {
                const [currentEvents] = await Promise.all([
                    eventService.getEvents(),
                    fetchAllTasks(true),
                ]);
                setEvents(currentEvents);
            } catch (refreshError) {
                console.error('Failed to refresh after undoing day template application:', refreshError);
            }
            throw error;
        }
    };

    const handleCreateTask = async (taskToCreate: TaskToCreate) => {
        const visibleCalendars = calendars.filter(calendar => calendar.visible);
        const selectedCalendarId = visibleCalendars.length === 1
            ? visibleCalendars[0].id
            : visibleCalendars.some(calendar => calendar.id === taskToCreate.calendarId)
                ? taskToCreate.calendarId
                : undefined;
        const taskWithResolvedCalendar = { ...taskToCreate, calendarId: selectedCalendarId };
        const optimisticTasks = createOptimisticTasks(taskWithResolvedCalendar, defaultCalendarId);
        const optimisticTaskIds = optimisticTasks.map(task => task.taskId);
        appendTasksToState(optimisticTasks);

        try {
            const createdTask = await taskService.createTask(taskWithResolvedCalendar);
            try {
                await fetchAllTasks(true);
            } catch (refreshError) {
                console.error('Error refreshing tasks after creation:', refreshError);
                removeTasksFromState(optimisticTaskIds);
                addTaskToState(createdTask);
            }
        } catch (err) {
            console.error('Error creating task:', err);
            removeTasksFromState(optimisticTaskIds);
            try {
                await fetchAllTasks(true);
            } catch (refreshError) {
                console.error('Error refreshing tasks after failed creation:', refreshError);
            }
            throw err;
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            await taskService.deleteTask(taskId);
            await fetchAllTasks(true);
        } catch (error) {
            console.error('Error deleting task from calendar:', error);
            await fetchAllTasks(true);
            throw error;
        }
    };

    const handleDeleteTaskOccurrence = async (taskId: string) => {
        try {
            await taskService.deleteTaskOccurrence(taskId);
            await fetchAllTasks(true);
        } catch (error) {
            console.error('Error deleting task occurrence from calendar:', error);
            await fetchAllTasks(true);
            throw error;
        }
    };

    const handleUpdateTask = async (taskId: string, updates: TaskUpdate) => {
        const originalTask = allTasks.find(task => task.taskId === taskId);
        if (!originalTask) return;

        const optimisticUpdates = Object.fromEntries(
            Object.entries(updates).filter(([field]) => field !== 'calendarScope'),
        ) as Partial<Task>;
        const relatedCalendarSnapshots = updates.calendarScope === 'series'
            && updates.calendarId !== undefined
            && originalTask.taskSeriesId
            ? allTasks
                .filter(task => task.taskSeriesId === originalTask.taskSeriesId && task.taskId !== taskId)
                .map(task => ({ taskId: task.taskId, calendarId: task.calendarId }))
            : [];
        updateTaskInState(taskId, optimisticUpdates);
        relatedCalendarSnapshots.forEach(snapshot => {
            updateTaskInState(snapshot.taskId, { calendarId: updates.calendarId });
        });

        try {
            const updatedTask = await taskService.updateTask(taskId, updates);
            if (!originalTask.completed && updates.completed === true && updatedTask.completed) {
                playAudioFeedback('taskCompleted');
            }
        } catch (err) {
            console.error('Error updating task from calendar:', err);
            updateTaskInState(taskId, originalTask);
            relatedCalendarSnapshots.forEach(snapshot => {
                updateTaskInState(snapshot.taskId, { calendarId: snapshot.calendarId });
            });
            throw err;
        }
    };

    return (
        <PageWrapper>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                width: '100%',
            }}>
                {calendarSettingsError && <Alert severity="error" sx={{ mb: 1 }}>{calendarSettingsError}</Alert>}
                <MonthCalendar
                    tasks={allTasks}
                    groups={groups}
                    events={events}
                    calendars={calendars}
                    calendarManager={(
                        <CalendarManager
                            calendars={calendars}
                            onUpdate={handleUpdateCalendar}
                            onCreate={handleCreateCalendar}
                            onDelete={handleDeleteCalendar}
                        />
                    )}
                    onCreateTask={handleCreateTask}
                    onDeleteTask={handleDeleteTask}
                    onDeleteTaskOccurrence={handleDeleteTaskOccurrence}
                    onUpdateTask={handleUpdateTask}
                    onCreateEvent={handleCreateEvent}
                    onUpdateEvent={handleUpdateEvent}
                    onMoveEventOccurrence={handleMoveEventOccurrence}
                    onDeleteEvent={handleDeleteEvent}
                    onCancelEventOccurrence={handleCancelEventOccurrence}
                    onRestoreEventOccurrence={handleRestoreEventOccurrence}
                    onUpdateEventOccurrenceStatus={handleUpdateEventOccurrenceStatus}
                    onDeleteEventOccurrence={handleDeleteEventOccurrence}
                    dayTemplates={dayTemplates}
                    onCreateDayTemplate={handleCreateDayTemplate}
                    onUpdateDayTemplate={handleUpdateDayTemplate}
                    onDeleteDayTemplate={handleDeleteDayTemplate}
                    onApplyDayTemplate={handleApplyDayTemplate}
                    onUndoDayTemplate={handleUndoDayTemplate}
                    statDefinitions={statDefinitions}
                    loading={calendarDataLoading || tasksLoading || calendarSettingsLoading}
                    onRefreshTasks={() => fetchAllTasks(true)}
                    onOpenDay={date => navigate(`/day/${date}`, { state: { returnTo: '/calendar' } })}
                />
            </Box>
        </PageWrapper>
    );
}
