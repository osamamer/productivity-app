import {
    Alert, Box, Button, Checkbox, Chip, Collapse, Dialog, DialogActions, DialogContent,
    DialogContentText, DialogTitle, Divider, FormControlLabel, FormGroup, List, ListItem,
    ListItemButton, ListItemText, Popover, Snackbar, IconButton,
    Fade, Skeleton, Stack, Switch, Tabs, Tab, TextField, ToggleButton, ToggleButtonGroup, Typography, Menu, MenuItem, ListItemIcon,
} from "@mui/material";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import React, { useMemo, useState, useCallback, useRef } from "react";
import { keyframes } from '@mui/system';
import { Task } from "../types/Task.tsx";
import { useTheme } from "@mui/material";
import { DayCellContentArg, DayCellMountArg, DatesSetArg, EventClickArg, EventContentArg, EventMountArg } from '@fullcalendar/core';
import { TaskToCreate } from "../types/TaskToCreate.tsx";
import { TaskGroup } from "../types/TaskGroup.ts";
import { StatDefinition, StatEntry } from "../types/Stats.ts";
import { formatDurationValue, formatTimeValue } from "../services/utils/statValues.ts";
import { DateStatCheckIn } from "./stats/DateStatCheckIn.tsx";
import { statService } from "../services/api/statService.ts";
import { addMonths, format, isAfter, startOfDay, startOfMonth, subDays } from "date-fns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckIcon from '@mui/icons-material/Check';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ViewDayIcon from '@mui/icons-material/ViewDay';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { CalendarEvent, CalendarEventInput, CalendarEventStatus } from "../types/CalendarEvent.ts";
import { DayTemplate, DayTemplateApplication, DayTemplateRequest } from "../types/DayTemplate.ts";
import { CalendarEventForm } from "./calendar/CalendarEventForm.tsx";
import { DayTemplateCreationDialog } from "./calendar/DayTemplateCreationDialog.tsx";
import { DAY_TEMPLATE_DRAG_TYPE, DayTemplatePanel, DayTemplatePreviewPopover } from "./calendar/DayTemplatePanel.tsx";
import { CalendarEventOccurrence, expandCalendarEvent } from "./calendar/recurrence.ts";
import { getBooleanChoiceColor } from "../services/statFeedback.ts";
import { dayService, taskService } from "../services/api";
import { getShowCompletedHomeTasks } from "../services/utils/homePreferences.ts";
import { AppDateField } from "./input/AppPickerFields";
import { TaskRecurrenceCustomOptions, TaskRecurrencePicker } from "./task/TaskRecurrencePicker";
import { TaskReminderPicker } from "./task/TaskReminderPicker";
import { CalendarTaskForm } from './calendar/CalendarTaskForm';
import { defaultTaskRecurrence, TaskRecurrenceDraft } from "../types/TaskRecurrence";
import { TaskSeries } from "../types/TaskSeries";
import { DayCalendarEntry } from "../types/DayEntity";
import { taskDateKey } from "../services/utils/taskDate";

type MonthCalenderProps = {
    tasks: Task[],
    groups: TaskGroup[],
    events: CalendarEvent[],
    onCreateTask: (task: TaskToCreate) => Promise<void>,
    onDeleteTask: (taskId: string) => Promise<void>,
    onDeleteTaskOccurrence: (taskId: string) => Promise<void>,
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>,
    onCreateEvent: (event: CalendarEventInput) => Promise<void>,
    onUpdateEvent: (eventId: string, event: CalendarEventInput) => Promise<void>,
    onDeleteEvent: (eventId: string) => Promise<void>,
    onCancelEventOccurrence: (eventId: string, occurrenceKey: string) => Promise<void>,
    onRestoreEventOccurrence: (eventId: string, occurrenceKey: string) => Promise<void>,
    onUpdateEventOccurrenceStatus: (eventId: string, occurrenceKey: string, status: CalendarEventStatus) => Promise<void>,
    onDeleteEventOccurrence: (eventId: string, occurrenceKey: string) => Promise<void>,
    dayTemplates: DayTemplate[],
    onCreateDayTemplate: (request: DayTemplateRequest) => Promise<void>,
    onUpdateDayTemplate: (templateId: string, request: DayTemplateRequest) => Promise<void>,
    onDeleteDayTemplate: (templateId: string) => Promise<void>,
    onApplyDayTemplate: (templateId: string, date: string) => Promise<DayTemplateApplication>,
    onUndoDayTemplate: (application: DayTemplateApplication) => Promise<void>,
    statDefinitions?: StatDefinition[],
    loading?: boolean,
    onRefreshTasks?: () => Promise<void>,
    onOpenDay?: (date: string) => void,
}

type TaskStatusFilter = 'all' | 'open' | 'completed';

const CALENDAR_DISPLAY_PREFERENCES_KEY = 'calendar-display-preferences';

type CalendarDisplayPreferences = {
    showTasks: boolean;
    showStats: boolean;
    taskStatus: TaskStatusFilter;
    priorityFilters: number[];
    selectedStatIds: string[] | null;
};

const DEFAULT_CALENDAR_DISPLAY_PREFERENCES: CalendarDisplayPreferences = {
    showTasks: true,
    showStats: true,
    taskStatus: 'all',
    priorityFilters: [3, 6, 9],
    selectedStatIds: null,
};

function readCalendarDisplayPreferences(): CalendarDisplayPreferences {
    if (typeof window === 'undefined') return DEFAULT_CALENDAR_DISPLAY_PREFERENCES;

    try {
        const stored = window.localStorage.getItem(CALENDAR_DISPLAY_PREFERENCES_KEY);
        if (!stored) return DEFAULT_CALENDAR_DISPLAY_PREFERENCES;

        const parsed = JSON.parse(stored) as Partial<CalendarDisplayPreferences>;
        return {
            showTasks: typeof parsed.showTasks === 'boolean'
                ? parsed.showTasks
                : DEFAULT_CALENDAR_DISPLAY_PREFERENCES.showTasks,
            showStats: typeof parsed.showStats === 'boolean'
                ? parsed.showStats
                : DEFAULT_CALENDAR_DISPLAY_PREFERENCES.showStats,
            taskStatus: parsed.taskStatus === 'open' || parsed.taskStatus === 'completed'
                ? parsed.taskStatus
                : DEFAULT_CALENDAR_DISPLAY_PREFERENCES.taskStatus,
            priorityFilters: Array.isArray(parsed.priorityFilters)
                ? parsed.priorityFilters.filter(value => PRIORITY_OPTIONS.some(option => option.value === value))
                : DEFAULT_CALENDAR_DISPLAY_PREFERENCES.priorityFilters,
            selectedStatIds: Array.isArray(parsed.selectedStatIds)
                ? parsed.selectedStatIds.filter((id): id is string => typeof id === 'string')
                : null,
        };
    } catch {
        return DEFAULT_CALENDAR_DISPLAY_PREFERENCES;
    }
}

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function priorityBucket(importance: number): number {
    if (importance > 7) return 9;
    if (importance > 4) return 6;
    return 3;
}

function statEventValue(definition: StatDefinition, value: number, status?: StatEntry['status']): string {
    if (status === 'NOT_PLANNED') return 'Not planned';
    if (definition.type === 'BOOLEAN') return value === 1 ? 'Yes' : 'No';
    if (definition.type === 'TIME') return formatTimeValue(value);
    if (definition.type === 'DURATION') return formatDurationValue(value);
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function calendarEventTimeLabel(start: Date | null): string {
    if (!start) return '';
    return format(start, start.getMinutes() === 0 ? 'h a' : 'h:mm a');
}

function recurrenceDraftFromSeries(series: TaskSeries | null): TaskRecurrenceDraft {
    if (!series?.active) return defaultTaskRecurrence();

    return {
        recurrenceFrequency: series.recurrenceFrequency,
        recurrenceEndDate: series.recurrenceEndDate,
        recurrenceInterval: series.recurrenceInterval,
        recurrenceUnit: series.recurrenceUnit,
        timeZone: series.timeZone,
    };
}

function recurrenceDraftsEqual(first: TaskRecurrenceDraft, second: TaskRecurrenceDraft): boolean {
    return first.recurrenceFrequency === second.recurrenceFrequency
        && first.recurrenceEndDate === second.recurrenceEndDate
        && first.recurrenceInterval === second.recurrenceInterval
        && first.recurrenceUnit === second.recurrenceUnit
        && first.timeZone === second.timeZone;
}

type CreateTab = 'event' | 'task' | 'stats';

const calendarLoadingReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 8px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

const calendarContentReveal = keyframes`
    from {
        opacity: 0;
        transform: translate3d(0, 7px, 0);
    }
    to {
        opacity: 1;
        transform: none;
    }
`;

function CalendarLoadingState() {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            gap: 1.5,
            animation: `${calendarLoadingReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                '& .MuiSkeleton-root': { animation: 'none' },
            },
        }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1 }}>
                <Skeleton animation="wave" variant="rounded" width={32} height={32} />
                <Skeleton animation="wave" variant="rounded" width={32} height={32} />
                <Skeleton animation="wave" variant="rounded" width={72} height={36} />
                <Skeleton animation="wave" variant="text" width={190} height={36} />
            </Stack>
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gridTemplateRows: 'auto repeat(6, minmax(0, 1fr))',
                gap: '1px',
                flex: 1,
                minHeight: 0,
                p: '1px',
                bgcolor: 'divider',
            }}>
                {Array.from({ length: 49 }, (_, index) => (
                    <Box key={index} sx={{
                        bgcolor: 'background.paper',
                        p: 1,
                        animation: `${calendarLoadingReveal} 360ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(index, 8) * 25}ms both`,
                        '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                            '& .MuiSkeleton-root': { animation: 'none' },
                        },
                    }}>
                        {index < 7 ? (
                            <Skeleton animation="wave" variant="text" width="65%" height={20} />
                        ) : (
                            <Skeleton animation="wave" variant="text" width="18%" height={20} sx={{ ml: 'auto' }} />
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

export function MonthCalendar({
    tasks, groups, events, onCreateTask, onDeleteTask, onDeleteTaskOccurrence, onUpdateTask, onCreateEvent, onUpdateEvent, onDeleteEvent,
    onCancelEventOccurrence, onRestoreEventOccurrence, onUpdateEventOccurrenceStatus, onDeleteEventOccurrence,
    dayTemplates, onCreateDayTemplate, onUpdateDayTemplate, onDeleteDayTemplate, onApplyDayTemplate, onUndoDayTemplate,
    statDefinitions, loading = false, onRefreshTasks, onOpenDay,
}: MonthCalenderProps) {
    const theme = useTheme();
    const availableStatDefinitions = useMemo(() => statDefinitions ?? [], [statDefinitions]);
    const [initialDisplayPreferences] = useState(readCalendarDisplayPreferences);
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editingDialogOpen, setEditingDialogOpen] = useState(false);
    const [taskCreationError, setTaskCreationError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<CreateTab>('event');
    const [selectedEventSelection, setSelectedEventSelection] = useState<{
        eventId: string;
        occurrenceKey: string;
    } | null>(null);
    const [selectedEventDialogOpen, setSelectedEventDialogOpen] = useState(false);
    const [selectedTaskGroupId, setSelectedTaskGroupId] = useState<string | null>(null);
    const [selectedTaskGroupDialogOpen, setSelectedTaskGroupDialogOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [selectedTaskSnapshot, setSelectedTaskSnapshot] = useState<Task | null>(null);
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [taskDraft, setTaskDraft] = useState<Partial<Task> | null>(null);
    const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
    const [taskSaving, setTaskSaving] = useState(false);
    const [taskDeleteConfirmationOpen, setTaskDeleteConfirmationOpen] = useState(false);
    const [taskDeleteMenuAnchor, setTaskDeleteMenuAnchor] = useState<HTMLElement | null>(null);
    const [taskDeleteScope, setTaskDeleteScope] = useState<'occurrence' | 'series' | null>(null);
    const [taskDeleteError, setTaskDeleteError] = useState<string | null>(null);
    const [taskDeleting, setTaskDeleting] = useState(false);
    const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrenceDraft>(defaultTaskRecurrence);
    const [recurrenceLoading, setRecurrenceLoading] = useState(false);
    const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
    const recurrenceDraftRef = useRef<TaskRecurrenceDraft>(defaultTaskRecurrence());
    const recurrenceOriginalDraftRef = useRef<TaskRecurrenceDraft>(defaultTaskRecurrence());
    const recurrenceDraftDirtyRef = useRef(false);
    const taskSeriesRef = useRef<TaskSeries | null>(null);
    const [showTasks, setShowTasks] = useState(initialDisplayPreferences.showTasks);
    const [showStats, setShowStats] = useState(initialDisplayPreferences.showStats);
    const [taskStatus, setTaskStatus] = useState<TaskStatusFilter>(initialDisplayPreferences.taskStatus);
    const [priorityFilters, setPriorityFilters] = useState<number[]>(initialDisplayPreferences.priorityFilters);
    // null means the user has not customized the list, so all definitions are
    // immediately visible as soon as they arrive from the parent.
    const [selectedStatIds, setSelectedStatIds] = useState<string[] | null>(initialDisplayPreferences.selectedStatIds);
    const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
    const [showTemplatePanel, setShowTemplatePanel] = useState(false);
    const [templateCreationOpen, setTemplateCreationOpen] = useState(false);
    const [templateEditTarget, setTemplateEditTarget] = useState<DayTemplate | null>(null);
    const [templatePreviewAnchor, setTemplatePreviewAnchor] = useState<HTMLElement | null>(null);
    const [templatePreview, setTemplatePreview] = useState<DayTemplate | null>(null);
    const [templateSourceDate, setTemplateSourceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [templateActionError, setTemplateActionError] = useState<string | null>(null);
    const [dayContextMenu, setDayContextMenu] = useState<{ date: string; top: number; left: number } | null>(null);
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
    const [templateFeedback, setTemplateFeedback] = useState<{
        id: number;
        application: DayTemplateApplication | null;
        message: string;
        undoing: boolean;
        severity: 'success' | 'error';
    } | null>(null);
    const templateFeedbackIdRef = useRef(0);
    const applyingTemplateRef = useRef<string | null>(null);
    const onApplyDayTemplateRef = useRef(onApplyDayTemplate);
    const dayCellListenersRef = useRef(new Map<HTMLElement, {
        dragOver: (event: DragEvent) => void;
        dragLeave: (event: DragEvent) => void;
        drop: (event: DragEvent) => void;
        contextMenu: (event: MouseEvent) => void;
    }>());

    React.useEffect(() => {
        onApplyDayTemplateRef.current = onApplyDayTemplate;
    }, [onApplyDayTemplate]);
    const [calendarRange, setCalendarRange] = useState({
        start: startOfMonth(new Date()),
        end: addMonths(startOfMonth(new Date()), 1),
    });
    const [dayCalendarEntries, setDayCalendarEntries] = useState<DayCalendarEntry[]>([]);
    const [statEntries, setStatEntries] = useState<StatEntry[]>([]);
    const [statRefreshKey, setStatRefreshKey] = useState(0);
    const selectedStatIdsForDisplay = useMemo(
        () => selectedStatIds ?? availableStatDefinitions.map(definition => definition.id),
        [availableStatDefinitions, selectedStatIds]
    );
    const selectedStatDefinitions = useMemo(
        () => availableStatDefinitions.filter(definition => selectedStatIdsForDisplay.includes(definition.id)),
        [availableStatDefinitions, selectedStatIdsForDisplay]
    );
    const hasVisibleStats = showStats && selectedStatDefinitions.length > 0;
    const isFutureDate = editingDate
        ? isAfter(startOfDay(new Date(editingDate + 'T12:00:00')), startOfDay(new Date()))
        : true;
    const selectedTask = useMemo(
        () => tasks.find(task => task.taskId === selectedTaskId)
            ?? (selectedTaskSnapshot?.taskId === selectedTaskId ? selectedTaskSnapshot : null),
        [selectedTaskId, selectedTaskSnapshot, tasks]
    );
    const selectedCalendarEvent = useMemo(
        () => events.find(event => event.id === selectedEventSelection?.eventId) ?? null,
        [events, selectedEventSelection]
    );
    const selectedCalendarEventOccurrence = useMemo<CalendarEventOccurrence | null>(() => {
        if (!selectedCalendarEvent || !selectedEventSelection) return null;
        return expandCalendarEvent(selectedCalendarEvent, calendarRange.start, calendarRange.end)
            .find(occurrence => occurrence.occurrenceKey === selectedEventSelection.occurrenceKey) ?? null;
    }, [calendarRange.end, calendarRange.start, selectedCalendarEvent, selectedEventSelection]);
    const selectedTaskGroup = useMemo(
        () => groups.find(group => group.groupId === selectedTaskGroupId) ?? null,
        [groups, selectedTaskGroupId]
    );

    React.useEffect(() => {
        let cancelled = false;
        setRecurrenceError(null);
        if (!selectedTaskId) {
            setRecurrenceLoading(false);
            taskSeriesRef.current = null;
            const emptyDraft = defaultTaskRecurrence();
            recurrenceDraftRef.current = emptyDraft;
            recurrenceOriginalDraftRef.current = emptyDraft;
            recurrenceDraftDirtyRef.current = false;
            setRecurrenceDraft(emptyDraft);
            return () => {
                cancelled = true;
            };
        }

        if (selectedTask?.optimisticRecurrence) {
            const nextDraft = selectedTask.optimisticRecurrence;
            setRecurrenceLoading(false);
            taskSeriesRef.current = null;
            recurrenceDraftRef.current = nextDraft;
            recurrenceOriginalDraftRef.current = nextDraft;
            recurrenceDraftDirtyRef.current = false;
            setRecurrenceDraft(nextDraft);
            return () => {
                cancelled = true;
            };
        }

        if (!selectedTask?.taskSeriesId) {
            const emptyDraft = defaultTaskRecurrence();
            setRecurrenceLoading(false);
            taskSeriesRef.current = null;
            recurrenceDraftRef.current = emptyDraft;
            recurrenceOriginalDraftRef.current = emptyDraft;
            recurrenceDraftDirtyRef.current = false;
            setRecurrenceDraft(emptyDraft);
            return () => {
                cancelled = true;
            };
        }

        setRecurrenceLoading(true);
        recurrenceDraftDirtyRef.current = false;
        taskService.getTaskSeries(selectedTaskId, selectedTask.taskSeriesId)
            .then(series => {
                if (cancelled) return;
                if (!series) {
                    setRecurrenceError('Unable to load recurrence.');
                    return;
                }
                const nextDraft = recurrenceDraftFromSeries(series);
                taskSeriesRef.current = series;
                recurrenceOriginalDraftRef.current = nextDraft;
                if (!recurrenceDraftDirtyRef.current) {
                    recurrenceDraftRef.current = nextDraft;
                    setRecurrenceDraft(nextDraft);
                }
            })
            .catch(() => {
                if (!cancelled) setRecurrenceError('Unable to load recurrence.');
            })
            .finally(() => {
                if (!cancelled) setRecurrenceLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedTask?.optimisticRecurrence, selectedTask?.taskSeriesId, selectedTaskId]);
    const taskGroupByTaskId = useMemo(() => {
        const groupByTaskId = new Map<string, TaskGroup>();
        [...groups]
            .sort((first, second) => first.displayOrder - second.displayOrder)
            .forEach(group => {
                group.taskIds.forEach(taskId => {
                    if (!groupByTaskId.has(taskId)) groupByTaskId.set(taskId, group);
                });
            });
        return groupByTaskId;
    }, [groups]);

    const showCompletedTasks = getShowCompletedHomeTasks();

    React.useEffect(() => {
        try {
            window.localStorage.setItem(CALENDAR_DISPLAY_PREFERENCES_KEY, JSON.stringify({
                showTasks,
                showStats,
                taskStatus,
                priorityFilters,
                selectedStatIds,
            } satisfies CalendarDisplayPreferences));
        } catch {
            // Preferences are optional; private browsing may make storage unavailable.
        }
    }, [priorityFilters, selectedStatIds, showStats, showTasks, taskStatus]);

    React.useEffect(() => {
        let cancelled = false;
        if (!hasVisibleStats) {
            setStatEntries([]);
            return () => { cancelled = true; };
        }

        const from = format(calendarRange.start, 'yyyy-MM-dd');
        const to = format(subDays(calendarRange.end, 1), 'yyyy-MM-dd');
        Promise.all(selectedStatDefinitions.map(definition => statService.getEntries(definition.id, from, to)))
            .then(entriesByDefinition => {
                if (!cancelled) setStatEntries(entriesByDefinition.flat());
            })
            .catch(error => {
                if (!cancelled) console.error('Failed to load calendar statistics:', error);
            });

        return () => { cancelled = true; };
    }, [calendarRange.end, calendarRange.start, hasVisibleStats, selectedStatDefinitions, statRefreshKey]);

    React.useEffect(() => {
        const controller = new AbortController();
        const from = format(calendarRange.start, 'yyyy-MM-dd');
        const to = format(subDays(calendarRange.end, 1), 'yyyy-MM-dd');
        dayService.getCalendarDays(from, to, controller.signal)
            .then(entries => setDayCalendarEntries(entries))
            .catch(error => {
                if (error?.name !== 'AbortError') {
                    console.error('Failed to load calendar day markers:', error);
                }
            });

        return () => controller.abort();
    }, [calendarRange.end, calendarRange.start]);

    const calendarTasks = useMemo(() => tasks.filter(task => {
        if (!task.scheduledPerformDateTime) return false;
        if (!showCompletedTasks && task.completed) return false;
        if (taskStatus === 'open' && task.completed) return false;
        if (taskStatus === 'completed' && !task.completed) return false;
        return priorityFilters.includes(priorityBucket(task.importance));
    }), [priorityFilters, showCompletedTasks, taskStatus, tasks]);

    const selectedTaskGroupTasks = useMemo(() => {
        if (!selectedTaskGroup) return [];

        const taskById = new Map(calendarTasks.map(task => [task.taskId, task]));
        return selectedTaskGroup.taskIds
            .map(taskId => taskById.get(taskId))
            .filter((task): task is Task => Boolean(task));
    }, [calendarTasks, selectedTaskGroup]);

    const calendarEvents = useMemo(() => {
        const taskById = new Map(tasks.map(task => [task.taskId, task]));
        const eventEntries = events.flatMap(event => expandCalendarEvent(
            event,
            calendarRange.start,
            calendarRange.end,
        ).map(occurrence => ({
            id: occurrence.id,
            title: event.title,
            start: occurrence.start,
            end: occurrence.end,
            allDay: occurrence.allDay,
            backgroundColor: occurrence.status === 'CANCELLED'
                ? `${theme.palette.text.disabled}30`
                : occurrence.status === 'TENTATIVE'
                    ? `${theme.palette.primary.main}70`
                    : theme.palette.primary.main,
            borderColor: occurrence.status === 'CANCELLED'
                ? theme.palette.text.disabled
                : theme.palette.primary.main,
            textColor: occurrence.status === 'CANCELLED'
                ? theme.palette.text.secondary
                : theme.palette.primary.contrastText,
            classNames: [occurrence.status === 'CANCELLED'
                ? 'calendar-cancelled-event'
                : occurrence.status === 'TENTATIVE'
                    ? 'calendar-tentative-event'
                    : 'calendar-accent-event'],
            extendedProps: {
                eventType: 'calendarEvent',
                eventTypeOrder: 0,
                calendarEventId: event.id,
                calendarEventOccurrenceKey: occurrence.occurrenceKey,
                calendarEventOccurrenceDate: occurrence.occurrenceDate,
                calendarEventOccurrenceStatus: occurrence.status,
                status: occurrence.status,
                fullDescription: `${event.description || event.title} · ${occurrence.status.toLowerCase()}`,
            },
        })));

        const groupEvents = showTasks
            ? Array.from(new Map(
                calendarTasks
                    .map(task => taskGroupByTaskId.get(task.taskId))
                    .filter((group): group is TaskGroup => Boolean(group))
                    .flatMap(group => {
                        const groupTaskDates = calendarTasks
                            .filter(task => taskGroupByTaskId.get(task.taskId)?.groupId === group.groupId)
                            .map(task => taskDateKey(task.scheduledPerformDateTime!));
                        return groupTaskDates.map(date => [`${group.groupId}-${date}`, { group, date }] as const);
                    })
            ).values()).map(({ group, date }) => ({
                id: `group-${group.groupId}-${date}`,
                title: group.name,
                date,
                groupId: group.groupId,
                backgroundColor: 'transparent',
                borderColor: theme.palette.divider,
                textColor: theme.palette.text.primary,
                classNames: ['calendar-neutral-event'],
                extendedProps: {
                    eventType: 'taskGroup',
                    eventTypeOrder: 1,
                    groupId: group.groupId,
                    groupOrder: group.displayOrder,
                    fullDescription: group.name,
                    completed: group.taskIds.length > 0
                        && group.taskIds.every(taskId => taskById.get(taskId)?.completed === true),
                },
            }))
            : [];

        const taskEvents = showTasks
            ? calendarTasks
                .filter(task => !taskGroupByTaskId.has(task.taskId))
                .map(task => {
                    const taskName = task.name || 'Untitled Task';
                    return {
                        id: task.taskId,
                        title: taskName,
                        start: task.scheduledPerformDateTime!,
                        allDay: false,
                        backgroundColor: 'transparent',
                        borderColor: theme.palette.divider,
                        textColor: theme.palette.text.primary,
                        classNames: ['calendar-neutral-event'],
                        extendedProps: {
                            eventType: 'task',
                            eventTypeOrder: 1,
                            fullDescription: taskName,
                            completed: task.completed,
                        },
                    };
                })
            : [];

        const definitionById = new Map(availableStatDefinitions.map(definition => [definition.id, definition]));
        const statEvents = hasVisibleStats
            ? statEntries.flatMap(entry => {
                if (!selectedStatIdsForDisplay.includes(entry.statDefinitionId)) return [];
                const definition = definitionById.get(entry.statDefinitionId);
                if (!definition) return [];
                const value = statEventValue(definition, entry.value, entry.status);
                const color = definition.type === 'BOOLEAN'
                    ? theme.palette[getBooleanChoiceColor(definition, entry.value === 1 ? 1 : 0, entry.status)].main
                    : theme.palette.secondary.main;
                return [{
                    id: `stat-${entry.statDefinitionId}-${entry.date}`,
                    title: `${definition.name}: ${value}`,
                    date: entry.date,
                    backgroundColor: `${color}20`,
                    borderColor: color,
                    textColor: theme.palette.text.primary,
                    extendedProps: {
                        eventType: 'stat',
                        eventTypeOrder: 2,
                        date: entry.date,
                        fullDescription: `${definition.name}: ${value}`,
                    },
                }];
            })
            : [];

        return [...eventEntries, ...groupEvents, ...taskEvents, ...statEvents];
    }, [availableStatDefinitions, calendarRange.end, calendarRange.start, calendarTasks, events, hasVisibleStats, selectedStatIdsForDisplay, showTasks, statEntries, tasks, taskGroupByTaskId, theme.palette]);

    const dayTemplateByDate = useMemo(
        () => new Map(
            dayCalendarEntries
                .filter(entry => Boolean(entry.appliedTemplateId))
                .map(entry => [entry.date, entry] as const)
        ),
        [dayCalendarEntries]
    );

    const renderEventContent = useCallback((arg: EventContentArg) => {
        const eventType = arg.event.extendedProps.eventType;
        const isTaskEntity = eventType === 'task' || eventType === 'taskGroup';
        const isCalendarEvent = eventType === 'calendarEvent';
        const isTimedEntry = isCalendarEvent || eventType === 'task';
        const completed = arg.event.extendedProps.completed === true;
        return (
            <Box className="calendar-event-content">
                {isTaskEntity && completed && (
                    <CheckIcon
                        aria-label="Completed"
                        sx={{
                            color: theme.palette.success.main,
                            flexShrink: 0,
                            fontSize: '1rem',
                        }}
                    />
                )}
                <Box component="span" className="calendar-event-title">
                    {arg.event.title || 'Untitled'}
                </Box>
                {isTimedEntry && !arg.event.allDay && arg.event.start && (
                    <Box component="span" className="calendar-event-time">
                        {calendarEventTimeLabel(arg.event.start)}
                    </Box>
                )}
            </Box>
        );
    }, [theme.palette.success.main]);

    const handleEventDidMount = useCallback((info: EventMountArg) => {
        const fullDescription = info.event.extendedProps.fullDescription;
        info.el.setAttribute('title', fullDescription);
        info.el.style.cursor = 'pointer';
    }, []);

    const handleDateClick = useCallback((arg: DateClickArg) => {
        if (arg.jsEvent.target instanceof Element
            && arg.jsEvent.target.closest('.calendar-template-day-button')) {
            return;
        }
        setEditingDate(arg.dateStr);
        setActiveTab('event');
        setEditingDialogOpen(true);
    }, []);

    const closeEditingDialog = useCallback(() => {
        setEditingDialogOpen(false);
        setActiveTab('event');
    }, []);

    const openTemplateCreation = useCallback((sourceDate?: string) => {
        setTemplateEditTarget(null);
        setTemplateSourceDate(sourceDate ?? (editingDialogOpen ? editingDate : null) ?? format(new Date(), 'yyyy-MM-dd'));
        setTemplateActionError(null);
        setTemplateCreationOpen(true);
        setEditingDialogOpen(false);
    }, [editingDate, editingDialogOpen]);

    const openTemplateEdit = useCallback((template: DayTemplate) => {
        setTemplatePreviewAnchor(null);
        setTemplatePreview(null);
        setTemplateEditTarget(template);
        setTemplateActionError(null);
        setTemplateCreationOpen(true);
        setEditingDialogOpen(false);
    }, []);

    const openTemplatePreview = useCallback((anchorEl: HTMLElement, template: DayTemplate) => {
        setTemplateCreationOpen(false);
        setTemplateEditTarget(null);
        setTemplatePreview(template);
        setTemplatePreviewAnchor(anchorEl);
    }, []);

    const handleDayTemplateClick = useCallback((event: React.MouseEvent, entry: DayCalendarEntry) => {
        event.preventDefault();
        event.stopPropagation();
        const template = dayTemplates.find(item => item.id === entry.appliedTemplateId);
        if (template) {
            openTemplatePreview(event.currentTarget as HTMLElement, template);
            return;
        }
        setTemplateActionError(`${entry.appliedTemplateName ?? 'That template'} is no longer available.`);
        setShowTemplatePanel(true);
    }, [dayTemplates, openTemplatePreview]);

    const renderDayCellContent = useCallback((arg: DayCellContentArg) => {
        const entry = dayTemplateByDate.get(format(arg.date, 'yyyy-MM-dd'));
        return (
            <Box className="calendar-day-cell-header">
                {entry ? (
                    <IconButton
                        className="calendar-template-day-button"
                        size="small"
                        aria-label={`View ${entry.appliedTemplateName ?? 'applied'} template`}
                        title={entry.appliedTemplateName ?? 'View applied template'}
                        onClick={event => handleDayTemplateClick(event, entry)}
                    >
                        <ViewDayIcon fontSize="inherit" />
                    </IconButton>
                ) : <Box className="calendar-template-day-button-placeholder" />}
                <Box component="span" className="calendar-day-number">{arg.dayNumberText}</Box>
            </Box>
        );
    }, [dayTemplateByDate, handleDayTemplateClick]);

    const handleSaveTemplate = useCallback(async (request: DayTemplateRequest) => {
        if (templateEditTarget) {
            await onUpdateDayTemplate(templateEditTarget.id, request);
            return;
        }
        await onCreateDayTemplate(request);
    }, [onCreateDayTemplate, onUpdateDayTemplate, templateEditTarget]);

    const handleTemplateDrop = useCallback(async (templateId: string, date: string) => {
        if (applyingTemplateRef.current !== null) return;

        applyingTemplateRef.current = templateId;
        setApplyingTemplateId(templateId);
        setTemplateActionError(null);
        try {
            const application = await onApplyDayTemplateRef.current(templateId, date);
            setDayCalendarEntries(current => [
                ...current.filter(entry => entry.date !== application.date),
                {
                    date: application.date,
                    appliedTemplateId: application.templateId,
                    appliedTemplateName: application.templateName,
                },
            ]);
            templateFeedbackIdRef.current += 1;
            setTemplateFeedback({
                id: templateFeedbackIdRef.current,
                application,
                message: `Applied “${application.templateName}” to ${format(new Date(`${application.date}T12:00:00`), 'MMM d')}`,
                undoing: false,
                severity: 'success',
            });
        } catch (error) {
            console.error('Failed to apply day template:', error);
            setTemplateActionError('Unable to apply that template. Please try again.');
        } finally {
            applyingTemplateRef.current = null;
            setApplyingTemplateId(null);
        }
    }, []);

    const undoTemplateApplication = useCallback(async () => {
        const feedback = templateFeedback;
        if (!feedback?.application || feedback.undoing) return;

        setTemplateFeedback(previous => previous
            ? { ...previous, message: 'Undoing template application…', undoing: true }
            : previous);
        try {
            await onUndoDayTemplate(feedback.application);
            setDayCalendarEntries(current => current.filter(entry => entry.date !== feedback.application?.date));
            setTemplateFeedback(null);
        } catch (error) {
            console.error('Failed to undo day template application:', error);
            templateFeedbackIdRef.current += 1;
            setTemplateFeedback({
                id: templateFeedbackIdRef.current,
                application: null,
                message: 'Could not undo that template application.',
                undoing: false,
                severity: 'error',
            });
        }
    }, [onUndoDayTemplate, templateFeedback]);

    const handleDayCellDidMount = useCallback((arg: DayCellMountArg) => {
        const contextMenu = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setDayContextMenu({
                date: format(arg.date, 'yyyy-MM-dd'),
                top: event.clientY,
                left: event.clientX,
            });
        };
        const dragOver = (event: DragEvent) => {
            const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : [];
            if (!types.includes(DAY_TEMPLATE_DRAG_TYPE)) return;

            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            arg.el.classList.add('calendar-template-drop-target');
        };
        const dragLeave = (event: DragEvent) => {
            if (!(event.relatedTarget instanceof Node) || !arg.el.contains(event.relatedTarget)) {
                arg.el.classList.remove('calendar-template-drop-target');
            }
        };
        const drop = (event: DragEvent) => {
            event.preventDefault();
            arg.el.classList.remove('calendar-template-drop-target');
            const templateId = event.dataTransfer?.getData(DAY_TEMPLATE_DRAG_TYPE);
            if (templateId) void handleTemplateDrop(templateId, format(arg.date, 'yyyy-MM-dd'));
        };

        arg.el.addEventListener('dragover', dragOver);
        arg.el.addEventListener('dragleave', dragLeave);
        arg.el.addEventListener('drop', drop);
        arg.el.addEventListener('contextmenu', contextMenu);
        dayCellListenersRef.current.set(arg.el, { dragOver, dragLeave, drop, contextMenu });
    }, [handleTemplateDrop]);

    const handleDayCellWillUnmount = useCallback((arg: DayCellMountArg) => {
        const listeners = dayCellListenersRef.current.get(arg.el);
        if (!listeners) return;
        arg.el.removeEventListener('dragover', listeners.dragOver);
        arg.el.removeEventListener('dragleave', listeners.dragLeave);
        arg.el.removeEventListener('drop', listeners.drop);
        arg.el.removeEventListener('contextmenu', listeners.contextMenu);
        dayCellListenersRef.current.delete(arg.el);
    }, []);

    const openTaskEditor = useCallback((task: Task) => {
        setSelectedTaskGroupDialogOpen(false);
        setSelectedTaskSnapshot(task);
        setRecurrenceLoading(Boolean(task.taskSeriesId) && !task.optimisticRecurrence);
        if (task.optimisticRecurrence) {
            recurrenceDraftRef.current = task.optimisticRecurrence;
            recurrenceOriginalDraftRef.current = task.optimisticRecurrence;
            setRecurrenceDraft(task.optimisticRecurrence);
        } else if (!task.taskSeriesId) {
            const emptyDraft = defaultTaskRecurrence();
            recurrenceDraftRef.current = emptyDraft;
            recurrenceOriginalDraftRef.current = emptyDraft;
            setRecurrenceDraft(emptyDraft);
        }
        setTaskDraft({
            name: task.name,
            description: task.description ?? '',
            importance: task.importance,
            scheduledPerformDateTime: task.scheduledPerformDateTime,
            reminderMinutesBefore: task.reminderMinutesBefore,
            tag: task.tag ?? '',
            completed: task.completed,
        });
        setTaskSaveError(null);
        setTaskDeleteError(null);
        setSelectedTaskId(task.taskId);
        setTaskDialogOpen(true);
    }, []);

    const handleEventClick = useCallback((arg: EventClickArg) => {
        if (arg.event.extendedProps.eventType === 'taskGroup') {
            const groupId = arg.event.extendedProps.groupId;
            if (typeof groupId === 'string') setSelectedTaskGroupId(groupId);
            setSelectedTaskGroupDialogOpen(true);
            return;
        }
        if (arg.event.extendedProps.eventType === 'calendarEvent') {
            const calendarEventId = arg.event.extendedProps.calendarEventId;
            const occurrenceKey = arg.event.extendedProps.calendarEventOccurrenceKey;
            if (typeof occurrenceKey !== 'string') return;
            setSelectedEventSelection({
                eventId: typeof calendarEventId === 'string' ? calendarEventId : arg.event.id,
                occurrenceKey,
            });
            setSelectedEventDialogOpen(true);
            return;
        }
        if (arg.event.extendedProps.eventType === 'stat') {
            setEditingDate(arg.event.extendedProps.date ?? arg.event.startStr);
            setActiveTab('stats');
            setEditingDialogOpen(true);
            return;
        }

        const task = tasks.find(item => item.taskId === arg.event.id);
        if (!task) return;

        openTaskEditor(task);
    }, [openTaskEditor, tasks]);

    const handleDatesSet = useCallback((arg: DatesSetArg) => {
        setCalendarRange(previous => previous.start.getTime() === arg.start.getTime()
            && previous.end.getTime() === arg.end.getTime()
            ? previous
            : { start: arg.start, end: arg.end });
    }, []);

    const togglePriority = (priority: number) => {
        setPriorityFilters(previous => previous.includes(priority)
            ? previous.filter(value => value !== priority)
            : [...previous, priority]);
    };

    const toggleStat = (statId: string) => {
        setSelectedStatIds(previous => {
            const selected = previous ?? availableStatDefinitions.map(definition => definition.id);
            return selected.includes(statId)
                ? selected.filter(id => id !== statId)
                : [...selected, statId];
        });
    };

    const handleTaskSubmit = useCallback(async (taskToCreate: TaskToCreate) => {
        setEditingDialogOpen(false);
        setTaskCreationError(null);
        try {
            await onCreateTask(taskToCreate);
        } catch (error) {
            console.error('Failed to create calendar task:', error);
            setTaskCreationError('Could not add the task. Please try again.');
        }
    }, [onCreateTask]);

    const closeTaskDialog = useCallback(() => {
        setTaskDialogOpen(false);
        setTaskDeleteConfirmationOpen(false);
        setTaskDeleteMenuAnchor(null);
        setTaskDeleteScope(null);
        setSelectedTaskId(null);
        setSelectedTaskSnapshot(null);
        setTaskDraft(null);
        setTaskSaving(false);
        setTaskDeleting(false);
        setTaskDeleteError(null);
    }, []);

    const openTaskDeleteConfirmation = useCallback((scope: 'occurrence' | 'series') => {
        setTaskDeleteScope(scope);
        setTaskDeleteConfirmationOpen(true);
    }, []);

    const handleTaskDelete = useCallback(async () => {
        if (!selectedTask || taskDeleting || !taskDeleteScope) return;

        setTaskDeleting(true);
        setTaskDeleteError(null);
        try {
            if (taskDeleteScope === 'occurrence') {
                await onDeleteTaskOccurrence(selectedTask.taskId);
            } else {
                await onDeleteTask(selectedTask.taskId);
            }
            setTaskDeleteConfirmationOpen(false);
            closeTaskDialog();
        } catch (error) {
            console.error('Failed to delete task from month calendar:', error);
            setTaskDeleteError('Failed to delete the task. Please try again.');
        } finally {
            setTaskDeleting(false);
        }
    }, [closeTaskDialog, onDeleteTask, onDeleteTaskOccurrence, selectedTask, taskDeleteScope, taskDeleting]);

    const handleTaskDateChange = useCallback((newDate: Date | null) => {
        if (!newDate) {
            setTaskDraft(prev => prev
                ? { ...prev, scheduledPerformDateTime: '', reminderMinutesBefore: null }
                : prev);
            return;
        }
        const pad = (n: number) => String(n).padStart(2, '0');
        const iso = `${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())}T${pad(newDate.getHours())}:${pad(newDate.getMinutes())}:00`;
        setTaskDraft(prev => prev ? { ...prev, scheduledPerformDateTime: iso } : prev);
    }, []);

    const handleTaskRecurrenceChange = (nextDraft: TaskRecurrenceDraft) => {
        if (!selectedTask || selectedTask.parentId) return;
        recurrenceDraftDirtyRef.current = true;
        recurrenceDraftRef.current = nextDraft;
        setRecurrenceDraft(nextDraft);
        setRecurrenceError(null);
    };

    const saveTaskRecurrence = useCallback(async (
        taskId: string,
        draft: TaskRecurrenceDraft,
        scheduledPerformDateTime: string,
    ) => {
        const currentSeries = taskSeriesRef.current;
        if (draft.recurrenceFrequency === 'NONE') {
            if (!currentSeries?.active) return;
            await taskService.stopTaskSeries(currentSeries.seriesId);
            taskSeriesRef.current = { ...currentSeries, active: false };
            recurrenceOriginalDraftRef.current = defaultTaskRecurrence();
            return;
        }

        if (!scheduledPerformDateTime) {
            throw new Error('A recurring task needs a scheduled date and time.');
        }

        const savedSeries = currentSeries
            ? await taskService.updateTaskSeries(currentSeries.seriesId, draft, true)
            : await taskService.startTaskRecurrence(taskId, draft);
        taskSeriesRef.current = savedSeries;
        recurrenceOriginalDraftRef.current = draft;
    }, []);

    const handleTaskSave = useCallback(async () => {
        if (!selectedTask || !taskDraft) return;

        const recurrenceToSave = recurrenceDraftRef.current;
        const recurrenceChanged = !recurrenceDraftsEqual(
            recurrenceToSave,
            recurrenceOriginalDraftRef.current,
        );
        if (recurrenceChanged
            && recurrenceToSave.recurrenceFrequency !== 'NONE'
            && !taskDraft.scheduledPerformDateTime) {
            setRecurrenceError('A recurring task needs a scheduled date and time.');
            return;
        }

        setTaskSaving(true);
        setTaskSaveError(null);
        try {
            await onUpdateTask(selectedTask.taskId, {
                name: taskDraft.name ?? '',
                description: taskDraft.description ?? '',
                importance: taskDraft.importance ?? selectedTask.importance,
                scheduledPerformDateTime: taskDraft.scheduledPerformDateTime ?? selectedTask.scheduledPerformDateTime,
                completed: taskDraft.completed ?? selectedTask.completed,
                reminderMinutesBefore: taskDraft.reminderMinutesBefore ?? null,
            });
            if (recurrenceChanged) {
                await saveTaskRecurrence(
                    selectedTask.taskId,
                    recurrenceToSave,
                    taskDraft.scheduledPerformDateTime ?? '',
                );
            }
            closeTaskDialog();
            await onRefreshTasks?.();
        } catch (error) {
            console.error('Failed to update task from month calendar:', error);
            setTaskSaveError('Failed to save task changes. Please try again.');
        } finally {
            setTaskSaving(false);
        }
    }, [closeTaskDialog, onRefreshTasks, onUpdateTask, saveTaskRecurrence, selectedTask, taskDraft]);

    return (
        <>
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                    }}
                >
                    {loading ? (
                        <CalendarLoadingState />
                    ) : (
                        <Box sx={{
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            animation: `${calendarContentReveal} 420ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                            '@media (prefers-reduced-motion: reduce)': {
                                animation: 'none',
                            },
                        }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Box>
                            <Typography variant="h6" fontWeight={600}>Calendar</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {showTasks ? 'Tasks' : 'Tasks hidden'} · {hasVisibleStats ? `${selectedStatDefinitions.length} stat${selectedStatDefinitions.length === 1 ? '' : 's'}` : 'Stats hidden'}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Button
                                size="small"
                                variant={showTemplatePanel ? 'contained' : 'outlined'}
                                startIcon={<ViewDayIcon />}
                                onClick={() => setShowTemplatePanel(previous => !previous)}
                                disabled={loading}
                            >
                                Templates{dayTemplates.length > 0 ? ` (${dayTemplates.length})` : ''}
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<FilterListIcon />}
                                onClick={event => setFilterAnchor(event.currentTarget)}
                                disabled={loading}
                            >
                                Display
                            </Button>
                        </Stack>
                    </Stack>

                    <Collapse in={showTemplatePanel} timeout={180} unmountOnExit>
                        <DayTemplatePanel
                            templates={dayTemplates}
                            applyingTemplateId={applyingTemplateId}
                            error={templateActionError}
                            onCreate={() => openTemplateCreation()}
                            onEdit={openTemplateEdit}
                            onDelete={onDeleteDayTemplate}
                            onDragStart={() => setTemplateActionError(null)}
                            onPreview={openTemplatePreview}
                        />
                    </Collapse>

            <Popover
                        open={Boolean(filterAnchor)}
                        anchorEl={filterAnchor}
                        onClose={() => setFilterAnchor(null)}
                        TransitionComponent={Fade}
                        transitionDuration={{ enter: 180, exit: 140 }}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        slotProps={{ paper: { sx: { p: 2, width: 320, maxHeight: '75vh' } } }}
                    >
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>What should appear?</Typography>
                        <FormGroup>
                            <FormControlLabel
                                control={<Switch checked={showTasks} onChange={event => setShowTasks(event.target.checked)} />}
                                label="Show tasks"
                            />
                            <FormControlLabel
                                control={<Switch checked={showStats} onChange={event => setShowStats(event.target.checked)} />}
                                label="Show statistics"
                            />
                        </FormGroup>

                        {showTasks && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="caption" color="text.secondary">Task status</Typography>
                                <ToggleButtonGroup
                                    exclusive
                                    fullWidth
                                    size="small"
                                    value={taskStatus}
                                    onChange={(_, value: TaskStatusFilter | null) => value && setTaskStatus(value)}
                                    sx={{ mt: 0.75 }}
                                >
                                    <ToggleButton value="all">All</ToggleButton>
                                    <ToggleButton value="open">Open</ToggleButton>
                                    <ToggleButton value="completed">Done</ToggleButton>
                                </ToggleButtonGroup>

                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                                    Priority levels
                                </Typography>
                                <Stack direction="row" spacing={0.25} sx={{ mt: 0.25 }}>
                                    {PRIORITY_OPTIONS.map(option => (
                                        <FormControlLabel
                                            key={option.value}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={priorityFilters.includes(option.value)}
                                                    onChange={() => togglePriority(option.value)}
                                                />
                                            }
                                            label={<Typography variant="caption">{option.label}</Typography>}
                                            sx={{ mr: 0.5 }}
                                        />
                                    ))}
                                </Stack>
                            </>
                        )}

                        {showStats && availableStatDefinitions.length > 0 && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="caption" color="text.secondary">Statistics to show</Typography>
                                    <Stack direction="row" spacing={0.25}>
                                        <Button size="small" onClick={() => setSelectedStatIds(availableStatDefinitions.map(definition => definition.id))}>
                                            All
                                        </Button>
                                        <Button size="small" onClick={() => setSelectedStatIds([])}>
                                            None
                                        </Button>
                                    </Stack>
                                </Stack>
                                <FormGroup>
                                    {availableStatDefinitions.map(definition => (
                                        <FormControlLabel
                                            key={definition.id}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={selectedStatIdsForDisplay.includes(definition.id)}
                                                    onChange={() => toggleStat(definition.id)}
                                                />
                                            }
                                            label={<Typography variant="body2" noWrap>{definition.name}</Typography>}
                                        />
                                    ))}
                                </FormGroup>
                            </>
                        )}
            </Popover>

            <Menu
                open={Boolean(dayContextMenu)}
                onClose={() => setDayContextMenu(null)}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 160, exit: 120 }}
                anchorReference="anchorPosition"
                anchorPosition={dayContextMenu
                    ? { top: dayContextMenu.top, left: dayContextMenu.left }
                    : undefined}
                MenuListProps={{ dense: true }}
            >
                <MenuItem onClick={() => {
                    if (!dayContextMenu) return;
                    const { date } = dayContextMenu;
                    setDayContextMenu(null);
                    openTemplateCreation(date);
                }}>
                    <ListItemIcon><SaveAsIcon fontSize="small" /></ListItemIcon>
                    Save day as template
                </MenuItem>
                <MenuItem onClick={() => {
                    if (dayContextMenu) onOpenDay?.(dayContextMenu.date);
                    setDayContextMenu(null);
                }}>
                    <ListItemIcon><ViewDayIcon fontSize="small" /></ListItemIcon>
                    View day
                </MenuItem>
            </Menu>

                    <Box
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            height: '100%',
                        '& .fc': {
                            height: '100%',
                            fontFamily: theme.typography.fontFamily,
                        },
                        '& .fc-theme-standard td, & .fc-theme-standard th': {
                            border: 'none',
                        },
                        '& .fc-scrollgrid': {
                            border: 'none',
                        },
                        '& .fc-daygrid-day': {
                            border: 'none',
                            outline: `1px solid ${theme.palette.divider}`,
                            outlineOffset: '-1px',
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.03)'
                                : 'rgba(0, 0, 0, 0.02)',
                            margin: '1px',
                            borderRadius: '0px',
                            transition: 'background-color 160ms ease',
                            cursor: 'pointer',
                            '&:hover': {
                                background: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.05)',
                            },
                        },
                        '& .fc-daygrid-day.calendar-template-drop-target': {
                            background: `${theme.palette.primary.main}35 !important`,
                            outline: `2px solid ${theme.palette.primary.main}`,
                            outlineOffset: '-2px',
                        },
                        '& .fc-daygrid-day-frame': {
                            minHeight: '80px',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '4px',
                        },
                        '& .fc-dayGridWeek-view .fc-daygrid-day-frame': {
                            minHeight: '128px',
                        },
                        '& .fc-dayGridWeek-view': {
                            maxWidth: '960px',
                            margin: '0 auto',
                        },
                        '& .fc-daygrid-day-top': {
                            flexDirection: 'row',
                            justifyContent: 'flex-start',
                        },
                        '& .fc-daygrid-day-top > .fc-daygrid-day-number': {
                            alignItems: 'center',
                            display: 'flex',
                            flex: '1 1 auto',
                            minWidth: 0,
                            padding: 0,
                        },
                        '& .calendar-day-cell-header': {
                            alignItems: 'center',
                            display: 'flex',
                            justifyContent: 'space-between',
                            minHeight: '28px',
                            padding: '0 2px 0 4px',
                            width: '100%',
                        },
                        '& .calendar-template-day-button, & .calendar-template-day-button-placeholder': {
                            flex: '0 0 24px',
                            height: '24px',
                            width: '24px',
                        },
                        '& .calendar-template-day-button': {
                            borderRadius: '4px',
                            color: `${theme.palette.primary.main} !important`,
                            fontSize: '1rem',
                            padding: 0,
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                            },
                        },
                        '& .calendar-day-number': {
                            alignItems: 'center',
                            display: 'inline-flex',
                            height: '24px',
                            lineHeight: 1,
                            padding: '0 4px',
                        },
                        '& .fc-day-today': {
                            background: `${theme.palette.primary.main}20 !important`,
                            borderRadius: '0px',
                            outline: `2px solid ${theme.palette.primary.main}`,
                            outlineOffset: '-2px',
                        },
                        '& .fc-day-today .fc-daygrid-day-number': {
                            color: theme.palette.primary.main,
                            fontWeight: 800,
                        },
                        '& .fc-toolbar-title': {
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: theme.palette.text.primary,
                        },
                        '& .fc-col-header-cell': {
                            border: 'none',
                            background: 'transparent',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: '0.75rem',
                            opacity: 0.7,
                            padding: '12px 4px',
                        },
                        '& .fc-daygrid-event': {
                            borderStyle: 'solid',
                            borderWidth: '1px',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            margin: '2px',
                            boxShadow: 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            '&:hover:not(.calendar-neutral-event)': {
                                filter: theme.palette.mode === 'dark' ? 'brightness(1.12)' : 'brightness(0.96)',
                            },
                        },
                        '& .fc-daygrid-event-dot': {
                            display: 'none',
                        },
                        '& .fc .calendar-accent-event': {
                            backgroundColor: `${theme.palette.primary.main} !important`,
                            borderColor: `${theme.palette.primary.main} !important`,
                            color: `${theme.palette.primary.contrastText} !important`,
                        },
                        '& .fc .calendar-accent-event .fc-event-main': {
                            color: `${theme.palette.primary.contrastText} !important`,
                        },
                        '& .fc .calendar-tentative-event': {
                            backgroundColor: `${theme.palette.primary.main}70 !important`,
                            border: `1px dashed ${theme.palette.primary.main} !important`,
                            color: `${theme.palette.primary.contrastText} !important`,
                        },
                        '& .fc .calendar-tentative-event .fc-event-main': {
                            color: `${theme.palette.primary.contrastText} !important`,
                        },
                        '& .fc .calendar-cancelled-event': {
                            backgroundColor: `${theme.palette.text.disabled}30 !important`,
                            borderColor: `${theme.palette.text.disabled} !important`,
                            color: `${theme.palette.text.secondary} !important`,
                            opacity: 0.75,
                        },
                        '& .fc .calendar-cancelled-event .fc-event-main': {
                            color: `${theme.palette.text.secondary} !important`,
                        },
                        '& .fc .calendar-cancelled-event .calendar-event-title': {
                            textDecoration: 'line-through',
                        },
                        '& .fc .calendar-neutral-event': {
                            backgroundColor: 'transparent !important',
                            borderColor: `${theme.palette.divider} !important`,
                            color: `${theme.palette.text.primary} !important`,
                        },
                        '& .fc-daygrid-event .fc-event-main': {
                            display: 'flex',
                            minWidth: 0,
                            width: '100%',
                        },
                        '& .calendar-event-content': {
                            alignItems: 'center',
                            display: 'flex',
                            gap: '4px',
                            minWidth: 0,
                            width: '100%',
                        },
                        '& .calendar-event-title': {
                            flex: '1 1 auto',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        },
                        '& .calendar-event-time': {
                            flex: '0 0 auto',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            marginLeft: 'auto',
                            paddingLeft: '4px',
                        },
                        '& .fc-button': {
                            border: 'none !important',
                            background: `${theme.palette.primary.main}30 !important`,
                            borderRadius: '8px !important',
                            color: `${theme.palette.text.primary} !important`,
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                                background: `${theme.palette.primary.main}50 !important`,
                            },
                            '&.fc-button-active': {
                                background: `${theme.palette.primary.main} !important`,
                            },
                        },
                        '& .fc-prev-button, & .fc-next-button': {
                            background: 'transparent !important',
                            border: 'none !important',
                            boxShadow: 'none !important',
                            color: `${theme.palette.text.secondary} !important`,
                            padding: '0.3rem !important',
                            minWidth: 'auto !important',
                        },
                        '& .fc-prev-button:hover, & .fc-next-button:hover': {
                            background: 'transparent !important',
                            color: `${theme.palette.text.primary} !important`,
                        },
                        '& .fc-prev-button .fc-icon, & .fc-next-button .fc-icon': {
                            fontSize: '1.2rem',
                            fontWeight: 700,
                        },
                        '& .fc-popover': {
                            border: `1px solid ${theme.palette.divider}`,
                            backgroundColor: `${theme.palette.background.default} !important`,
                            color: theme.palette.text.primary,
                            boxShadow: theme.shadows[8],
                            borderRadius: '8px',
                            overflow: 'hidden',
                        },
                        '& .fc-popover-header': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.03)',
                            color: theme.palette.text.primary,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            padding: '7px 10px',
                        },
                        '& .fc-popover-body': {
                            backgroundColor: `${theme.palette.background.default} !important`,
                            padding: '3px 4px',
                        },
                        '& .fc-more-popover .fc-daygrid-event-harness': {
                            marginBottom: '2px',
                        },
                        '& .fc-more-popover-misc': {
                            display: 'none',
                        },
                        '& .fc-popover-close': {
                            color: `${theme.palette.text.secondary} !important`,
                        },
                        }}
                    >
                        <FullCalendar
                            plugins={[dayGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            height="100%"
                            events={calendarEvents}
                            dayCellContent={renderDayCellContent}
                            eventContent={renderEventContent}
                            eventOrder="eventTypeOrder,start,title"
                            eventDidMount={handleEventDidMount}
                            eventClick={handleEventClick}
                            dateClick={handleDateClick}
                            datesSet={handleDatesSet}
                            dayCellDidMount={handleDayCellDidMount}
                            dayCellWillUnmount={handleDayCellWillUnmount}
                            dayMaxEvents={4}
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridWeek,dayGridMonth'
                            }}
                            buttonText={{
                                today: 'Today',
                                month: 'Month',
                                week: 'Week',
                            }}
                        />
                    </Box>
                        </Box>
                    )}
            </Box>

            <Dialog
                open={editingDialogOpen}
                onClose={closeEditingDialog}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 180, exit: 140 }}
                fullWidth
                maxWidth="sm"
                scroll="paper"
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(30, 30, 30, 0.98)'
                                : 'rgba(250, 250, 250, 0.98)',
                            boxShadow: theme.shadows[8],
                            width: '100%',
                            maxHeight: '80vh',
                        },
                    },
                }}
            >
                <Box sx={{ pt: 2 }}>
                    {editingDate && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                                {format(new Date(editingDate + 'T12:00:00'), 'MMMM d, yyyy')}
                            </Typography>
                            <Button size="small" onClick={() => openTemplateCreation(editingDate)}>
                                Save day as template
                            </Button>
                        </Stack>
                    )}
                    <Tabs
                        value={activeTab}
                        onChange={(_, value: CreateTab) => setActiveTab(value)}
                        sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
                        variant="fullWidth"
                    >
                        <Tab value="event" label="Event" />
                        <Tab value="task" label="Task" />
                        {hasVisibleStats && !isFutureDate && <Tab value="stats" label="Stats" />}
                    </Tabs>
                </Box>

                <DialogContent dividers sx={{ p: 0 }}>
                    {activeTab === 'event' && editingDate && (
                        <CalendarEventForm
                            initialDate={editingDate}
                            onSave={async event => {
                                await onCreateEvent(event);
                                setEditingDialogOpen(false);
                            }}
                            onCancel={closeEditingDialog}
                        />
                    )}
                    {activeTab === 'task' && (
                        editingDate && (
                            <CalendarTaskForm
                                key={editingDate}
                                initialDate={editingDate}
                                onSave={handleTaskSubmit}
                                onCancel={closeEditingDialog}
                            />
                        )
                    )}
                    {activeTab === 'stats' && hasVisibleStats && editingDate && (
                        <DateStatCheckIn
                            date={editingDate}
                            definitions={selectedStatDefinitions}
                            onSaved={() => {
                                setStatRefreshKey(key => key + 1);
                                setEditingDialogOpen(false);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <DayTemplateCreationDialog
                open={templateCreationOpen}
                initialDate={templateSourceDate}
                events={events}
                tasks={tasks}
                template={templateEditTarget}
                onSave={handleSaveTemplate}
                onClose={() => {
                    setTemplateCreationOpen(false);
                    setTemplateEditTarget(null);
                }}
            />

            <DayTemplatePreviewPopover
                template={templatePreview}
                anchorEl={templatePreviewAnchor}
                onClose={() => {
                    setTemplatePreviewAnchor(null);
                    setTemplatePreview(null);
                }}
            />

            <Dialog
                open={selectedEventDialogOpen}
                onClose={() => setSelectedEventDialogOpen(false)}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 180, exit: 140 }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {selectedCalendarEvent?.title || 'Event details'}
                    {selectedCalendarEventOccurrence && ` · ${selectedCalendarEventOccurrence.occurrenceDate}`}
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {selectedCalendarEvent && (
                        <CalendarEventForm
                            key={`${selectedCalendarEvent.id}-${selectedCalendarEventOccurrence?.occurrenceKey ?? 'series'}`}
                            initialDate={selectedCalendarEvent.startDate
                                ?? format(new Date(selectedCalendarEvent.startTime!), 'yyyy-MM-dd')}
                            event={selectedCalendarEvent}
                            occurrenceKey={selectedCalendarEventOccurrence?.occurrenceKey}
                            occurrenceDate={selectedCalendarEventOccurrence?.occurrenceDate}
                            occurrenceStatus={selectedCalendarEventOccurrence?.status}
                            onSave={async event => {
                                await onUpdateEvent(selectedCalendarEvent.id, event);
                                setSelectedEventDialogOpen(false);
                            }}
                            onCancelOccurrence={selectedEventSelection
                                ? async () => {
                                    await onCancelEventOccurrence(
                                        selectedCalendarEvent.id,
                                        selectedEventSelection.occurrenceKey,
                                    );
                                    setSelectedEventDialogOpen(false);
                                }
                                : undefined}
                            onRestoreOccurrence={selectedEventSelection
                                ? async () => {
                                    await onRestoreEventOccurrence(
                                        selectedCalendarEvent.id,
                                        selectedEventSelection.occurrenceKey,
                                    );
                                    setSelectedEventDialogOpen(false);
                                }
                                : undefined}
                            onUpdateOccurrenceStatus={selectedEventSelection
                                ? async status => {
                                    await onUpdateEventOccurrenceStatus(
                                        selectedCalendarEvent.id,
                                        selectedEventSelection.occurrenceKey,
                                        status,
                                    );
                                }
                                : undefined}
                            onDeleteOccurrence={selectedEventSelection
                                ? async () => {
                                    await onDeleteEventOccurrence(
                                        selectedCalendarEvent.id,
                                        selectedEventSelection.occurrenceKey,
                                    );
                                    setSelectedEventDialogOpen(false);
                                }
                                : undefined}
                            onDelete={async () => {
                                await onDeleteEvent(selectedCalendarEvent.id);
                                setSelectedEventDialogOpen(false);
                            }}
                            onCancel={() => setSelectedEventDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={selectedTaskGroupDialogOpen}
                onClose={() => setSelectedTaskGroupDialogOpen(false)}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 180, exit: 140 }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{selectedTaskGroup?.name || 'Task group'}</DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    {selectedTaskGroupTasks.length > 0 ? (
                        <List disablePadding>
                            {selectedTaskGroupTasks.map(task => (
                                <ListItem key={task.taskId} disablePadding divider>
                                    <ListItemButton onClick={() => openTaskEditor(task)}>
                                        <ListItemText
                                            primary={task.name || 'Untitled Task'}
                                            secondary={`${format(new Date(task.scheduledPerformDateTime!), 'MMM d, yyyy, HH:mm')} · ${task.completed ? 'Completed' : 'Open'}`}
                                            primaryTypographyProps={{
                                                sx: {
                                                    textDecoration: task.completed ? 'line-through' : 'none',
                                                    color: task.completed ? 'text.secondary' : 'text.primary',
                                                },
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Box sx={{ p: 2 }}>
                            <Typography color="text.secondary">
                                No tasks in this group match the current calendar filters.
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedTaskGroupDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={taskDialogOpen}
                onClose={() => !taskDeleting && closeTaskDialog()}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 180, exit: 140 }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{selectedTask?.name || 'Task details'}</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    {taskDraft && selectedTask && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={Boolean(taskDraft.completed)}
                                        onChange={event => setTaskDraft(prev => prev
                                            ? { ...prev, completed: event.target.checked }
                                            : prev)}
                                        inputProps={{ 'aria-label': `Mark ${selectedTask.name} as ${taskDraft.completed ? 'incomplete' : 'complete'}` }}
                                    />
                                }
                                label={taskDraft.completed ? 'Completed' : 'Mark as complete'}
                            />
                            <TextField
                                label="Name"
                                autoComplete="off"
                                value={taskDraft.name ?? ''}
                                onChange={(event) => setTaskDraft(prev => prev ? { ...prev, name: event.target.value } : prev)}
                                fullWidth
                            />

                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, textAlign: 'left' }}>
                                    Priority
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {PRIORITY_OPTIONS.map(option => {
                                        const selected = (taskDraft.importance ?? selectedTask.importance) === option.value;
                                        return (
                                            <Chip
                                                key={option.label}
                                                label={option.label}
                                                onClick={() => setTaskDraft(prev => prev ? { ...prev, importance: option.value } : prev)}
                                                sx={{
                                                    borderColor: option.color,
                                                    color: selected ? '#fff' : option.color,
                                                    backgroundColor: selected ? option.color : 'transparent',
                                                    border: `1px solid ${option.color}`,
                                                    cursor: 'pointer',
                                                    fontWeight: selected ? 600 : 400,
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>

                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <Box>
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: selectedTask.parentId
                                                ? 'minmax(0, 1fr)'
                                                : { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 3fr) minmax(0, 1fr)' },
                                            gap: 1.25,
                                            alignItems: 'start',
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0 }}>
                                            <Collapse
                                                in={Boolean(taskDraft.scheduledPerformDateTime)
                                                    && recurrenceDraft.recurrenceFrequency !== 'NONE'}
                                                timeout={180}
                                                unmountOnExit
                                            >
                                                <TimePicker
                                                    label="Scheduled"
                                                    value={taskDraft.scheduledPerformDateTime
                                                        ? new Date(taskDraft.scheduledPerformDateTime)
                                                        : null}
                                                    onChange={handleTaskDateChange}
                                                    ampm={false}
                                                    slotProps={{
                                                        field: { clearable: false },
                                                        textField: { size: 'small', fullWidth: true },
                                                    }}
                                                />
                                            </Collapse>
                                            <Collapse
                                                in={!taskDraft.scheduledPerformDateTime
                                                    || recurrenceDraft.recurrenceFrequency === 'NONE'}
                                                timeout={180}
                                                unmountOnExit
                                            >
                                                <DateTimePicker
                                                    label="Scheduled"
                                                    value={taskDraft.scheduledPerformDateTime
                                                        ? new Date(taskDraft.scheduledPerformDateTime)
                                                        : null}
                                                    onChange={handleTaskDateChange}
                                                    ampm={false}
                                                    slotProps={{
                                                        field: { clearable: true },
                                                        textField: { size: 'small', fullWidth: true },
                                                    }}
                                                />
                                            </Collapse>
                                        </Box>
                                        {!selectedTask.parentId && recurrenceLoading && (
                                            <Skeleton variant="rounded" height={40} />
                                        )}
                                        {!selectedTask.parentId && !recurrenceLoading && (
                                            <TaskRecurrencePicker
                                                value={recurrenceDraft}
                                                onChange={handleTaskRecurrenceChange}
                                                disabled={Boolean(selectedTask.optimisticRecurrence)}
                                                showEndDate={false}
                                                showCustomOptions={false}
                                            />
                                        )}
                                    </Box>
                                    {!selectedTask.parentId && (
                                        <Collapse in={recurrenceDraft.recurrenceFrequency !== 'NONE'} timeout={180} unmountOnExit>
                                            <Box sx={{
                                                mt: 1.25,
                                                display: 'grid',
                                                gridTemplateColumns: recurrenceDraft.recurrenceFrequency === 'CUSTOM'
                                                    ? { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }
                                                    : 'minmax(0, 1fr)',
                                                gap: 1.25,
                                                alignItems: 'start',
                                            }}>
                                                {recurrenceDraft.recurrenceFrequency === 'CUSTOM' && (
                                                        <TaskRecurrenceCustomOptions
                                                            value={recurrenceDraft}
                                                            onChange={handleTaskRecurrenceChange}
                                                            disabled={Boolean(selectedTask.optimisticRecurrence)}
                                                        />
                                                )}
                                                <AppDateField
                                                    label="Repeat until (optional)"
                                                    value={recurrenceDraft.recurrenceEndDate ?? ''}
                                                    onChange={recurrenceEndDate => handleTaskRecurrenceChange({
                                                        ...recurrenceDraft,
                                                        recurrenceEndDate: recurrenceEndDate || null,
                                                    })}
                                                    disabled={Boolean(selectedTask.optimisticRecurrence)}
                                                />
                                            </Box>
                                        </Collapse>
                                    )}
                                    {recurrenceError && (
                                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                            {recurrenceError}
                                        </Typography>
                                    )}
                                </Box>
                            </LocalizationProvider>

                            <TaskReminderPicker
                                value={taskDraft.reminderMinutesBefore}
                                disabled={!taskDraft.scheduledPerformDateTime}
                                onChange={reminderMinutesBefore => setTaskDraft(prev => prev
                                    ? { ...prev, reminderMinutesBefore }
                                    : prev)}
                            />

                            <TextField
                                label="Description"
                                autoComplete="off"
                                value={taskDraft.description ?? ''}
                                onChange={(event) => setTaskDraft(prev => prev ? { ...prev, description: event.target.value } : prev)}
                                multiline
                                minRows={3}
                                maxRows={8}
                                fullWidth
                            />

                            {selectedTask.tag && (
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
                                    Tag: <strong>{selectedTask.tag}</strong>
                                </Typography>
                            )}

                            {taskSaveError && <Alert severity="error">{taskSaveError}</Alert>}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between' }}>
                    <Button
                        color="error"
                        onClick={event => {
                            setTaskDeleteError(null);
                            if (selectedTask?.taskSeriesId) {
                                setTaskDeleteMenuAnchor(event.currentTarget);
                            } else {
                                openTaskDeleteConfirmation('series');
                            }
                        }}
                        disabled={taskSaving || taskDeleting || Boolean(selectedTask?.optimisticRecurrence)}
                    >
                        Delete
                    </Button>
                    <Stack direction="row" spacing={1}>
                        <Button onClick={closeTaskDialog} disabled={taskDeleting}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={() => void handleTaskSave()}
                            disabled={taskSaving || taskDeleting || Boolean(selectedTask?.optimisticRecurrence)
                                || !(taskDraft?.name ?? '').trim()}
                        >
                            {taskSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </Stack>
                </DialogActions>
            </Dialog>

            <Menu
                anchorEl={taskDeleteMenuAnchor}
                open={Boolean(taskDeleteMenuAnchor)}
                onClose={() => setTaskDeleteMenuAnchor(null)}
            >
                <MenuItem
                    onClick={() => {
                        setTaskDeleteMenuAnchor(null);
                        openTaskDeleteConfirmation('occurrence');
                    }}
                >
                    This occurrence
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setTaskDeleteMenuAnchor(null);
                        openTaskDeleteConfirmation('series');
                    }}
                >
                    All occurrences
                </MenuItem>
            </Menu>

            <Dialog
                open={taskDeleteConfirmationOpen}
                onClose={() => !taskDeleting && setTaskDeleteConfirmationOpen(false)}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>
                    {taskDeleteScope === 'occurrence'
                        ? 'Delete this occurrence?'
                        : selectedTask?.taskSeriesId ? 'Delete task series?' : 'Delete task?'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {taskDeleteScope === 'occurrence'
                            ? `Delete “${selectedTask?.name ?? 'this task'}” from this date? This occurrence will be removed from your calendar.`
                            : selectedTask?.taskSeriesId
                            ? `Delete “${selectedTask.name}” and all occurrences in its series?`
                            : `Delete “${selectedTask?.name ?? 'this task'}” and its subtasks?`}
                    </DialogContentText>
                    {taskDeleteError && <Alert severity="error" sx={{ mt: 2 }}>{taskDeleteError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTaskDeleteConfirmationOpen(false)} disabled={taskDeleting}>
                        Keep task
                    </Button>
                    <Button color="error" variant="contained" onClick={() => void handleTaskDelete()} disabled={taskDeleting}>
                        {taskDeleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                key={templateFeedback?.id}
                open={templateFeedback !== null}
                autoHideDuration={templateFeedback?.application ? 7000 : 4500}
                onClose={(_, reason) => {
                    if (reason !== 'clickaway' && !templateFeedback?.undoing) setTemplateFeedback(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                sx={{
                    right: { xs: 12, sm: 28 },
                    bottom: { xs: 12, sm: 28 },
                }}
            >
                {templateFeedback ? (
                    <Alert
                        severity={templateFeedback.severity}
                        variant="outlined"
                        icon={<InfoOutlinedIcon fontSize="small" />}
                        action={templateFeedback.application ? (
                            <Button
                                size="small"
                                color="inherit"
                                startIcon={<ReplayIcon fontSize="small" />}
                                onClick={() => void undoTemplateApplication()}
                                disabled={templateFeedback.undoing}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                {templateFeedback.undoing ? 'Undoing…' : 'Undo'}
                            </Button>
                        ) : undefined}
                        onClose={() => {
                            if (!templateFeedback.undoing) setTemplateFeedback(null);
                        }}
                        sx={{
                            minWidth: 260,
                            maxWidth: 'calc(100vw - 48px)',
                            alignItems: 'center',
                            backgroundColor: 'background.paper',
                            '& .MuiAlert-message': {
                                minWidth: 0,
                            },
                            '& .MuiAlert-action': {
                                alignSelf: 'center',
                                m: 0,
                                ml: 1,
                            },
                        }}
                    >
                        {templateFeedback.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
            <Snackbar
                open={taskCreationError !== null}
                autoHideDuration={4500}
                onClose={(_, reason) => {
                    if (reason !== 'clickaway') setTaskCreationError(null);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                sx={{ right: { xs: 12, sm: 28 }, bottom: { xs: 12, sm: 28 } }}
            >
                {taskCreationError ? (
                    <Alert
                        severity="error"
                        variant="outlined"
                        onClose={() => setTaskCreationError(null)}
                        sx={{ backgroundColor: 'background.paper' }}
                    >
                        {taskCreationError}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </>
    );
}
