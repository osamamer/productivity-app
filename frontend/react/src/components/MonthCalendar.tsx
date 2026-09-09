import {
    Alert, Box, Button, Checkbox, Chip, Collapse, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, FormControlLabel, FormGroup, List, ListItem,
    ListItemButton, ListItemText, Popover,
    Fade, Skeleton, Stack, Switch, Tabs, Tab, TextField, ToggleButton, ToggleButtonGroup, Typography, Menu, MenuItem, ListItemIcon,
} from "@mui/material";
import { HoverCardBox } from "./box/HoverCardBox.tsx";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import React, { useMemo, useState, useCallback, useRef } from "react";
import { keyframes } from '@mui/system';
import { Task } from "../types/Task.tsx";
import { useTheme } from "@mui/material";
import { DayCellMountArg, DatesSetArg, EventClickArg, EventContentArg, EventMountArg } from '@fullcalendar/core';
import { TaskToCreate } from "../types/TaskToCreate.tsx";
import { TaskGroup } from "../types/TaskGroup.ts";
import { SmartTaskInput } from "./input/SmartTaskInput.tsx";
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
import { CalendarEvent, CalendarEventInput } from "../types/CalendarEvent.ts";
import { DayTemplate, DayTemplateRequest } from "../types/DayTemplate.ts";
import { CalendarEventForm } from "./calendar/CalendarEventForm.tsx";
import { DayTemplateCreationDialog } from "./calendar/DayTemplateCreationDialog.tsx";
import { DAY_TEMPLATE_DRAG_TYPE, DayTemplatePanel } from "./calendar/DayTemplatePanel.tsx";
import { expandCalendarEvent } from "./calendar/recurrence.ts";
import { getBooleanChoiceColor } from "../services/statFeedback.ts";
import { taskService } from "../services/api";
import { getShowCompletedHomeTasks } from "../services/utils/homePreferences.ts";
import { AppDateField } from "./input/AppPickerFields";
import { TaskRecurrenceCustomOptions, TaskRecurrencePicker } from "./task/TaskRecurrencePicker";
import { TaskReminderPicker } from "./task/TaskReminderPicker";
import { defaultTaskRecurrence, TaskRecurrenceDraft } from "../types/TaskRecurrence";
import { TaskSeries } from "../types/TaskSeries";

type MonthCalenderProps = {
    tasks: Task[],
    groups: TaskGroup[],
    events: CalendarEvent[],
    onCreateTask: (task: TaskToCreate) => void,
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>,
    onCreateEvent: (event: CalendarEventInput) => Promise<void>,
    onUpdateEvent: (eventId: string, event: CalendarEventInput) => Promise<void>,
    onDeleteEvent: (eventId: string) => Promise<void>,
    dayTemplates: DayTemplate[],
    onCreateDayTemplate: (request: DayTemplateRequest) => Promise<void>,
    onApplyDayTemplate: (templateId: string, date: string) => Promise<void>,
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

function statEventValue(definition: StatDefinition, value: number): string {
    if (definition.type === 'BOOLEAN') return value === 1 ? 'Yes' : 'No';
    if (definition.type === 'TIME') return formatTimeValue(value);
    if (definition.type === 'DURATION') return formatDurationValue(value);
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function calendarEventTimeLabel(start: Date | null): string {
    if (!start) return '';
    return format(start, start.getMinutes() === 0 ? 'h a' : 'h:mm a');
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
    tasks, groups, events, onCreateTask, onUpdateTask, onCreateEvent, onUpdateEvent, onDeleteEvent,
    dayTemplates, onCreateDayTemplate, onApplyDayTemplate, statDefinitions, loading = false, onRefreshTasks, onOpenDay,
}: MonthCalenderProps) {
    const theme = useTheme();
    const availableStatDefinitions = useMemo(() => statDefinitions ?? [], [statDefinitions]);
    const [initialDisplayPreferences] = useState(readCalendarDisplayPreferences);
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editingDialogOpen, setEditingDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<CreateTab>('event');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedEventDialogOpen, setSelectedEventDialogOpen] = useState(false);
    const [selectedTaskGroupId, setSelectedTaskGroupId] = useState<string | null>(null);
    const [selectedTaskGroupDialogOpen, setSelectedTaskGroupDialogOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [taskDraft, setTaskDraft] = useState<Partial<Task> | null>(null);
    const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
    const [taskSaving, setTaskSaving] = useState(false);
    const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrenceDraft>(defaultTaskRecurrence);
    const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
    const recurrenceDraftRef = useRef<TaskRecurrenceDraft>(defaultTaskRecurrence());
    const taskSeriesRef = useRef<TaskSeries | null>(null);
    const recurrenceMutationRef = useRef<Promise<void>>(Promise.resolve());
    const recurrenceRequestIdRef = useRef(0);
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
    const [templateSourceDate, setTemplateSourceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [templateActionError, setTemplateActionError] = useState<string | null>(null);
    const [dayContextMenu, setDayContextMenu] = useState<{ date: string; top: number; left: number } | null>(null);
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
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
        () => tasks.find(task => task.taskId === selectedTaskId) ?? null,
        [selectedTaskId, tasks]
    );
    const selectedCalendarEvent = useMemo(
        () => events.find(event => event.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );
    const selectedTaskGroup = useMemo(
        () => groups.find(group => group.groupId === selectedTaskGroupId) ?? null,
        [groups, selectedTaskGroupId]
    );

    React.useEffect(() => {
        let cancelled = false;
        setRecurrenceError(null);
        if (!selectedTask) {
            taskSeriesRef.current = null;
            recurrenceDraftRef.current = defaultTaskRecurrence();
            setRecurrenceDraft(recurrenceDraftRef.current);
            return () => {
                cancelled = true;
            };
        }

        if (!selectedTask.taskSeriesId) {
            taskSeriesRef.current = null;
            recurrenceDraftRef.current = defaultTaskRecurrence();
            setRecurrenceDraft(recurrenceDraftRef.current);
        }

        taskService.getTaskSeries(selectedTask.taskId)
            .then(series => {
                if (cancelled) return;
                const nextDraft = series?.active
                    ? {
                        recurrenceFrequency: series.recurrenceFrequency,
                        recurrenceEndDate: series.recurrenceEndDate,
                        recurrenceInterval: series.recurrenceInterval,
                        recurrenceUnit: series.recurrenceUnit,
                        timeZone: series.timeZone,
                    }
                    : defaultTaskRecurrence();
                taskSeriesRef.current = series;
                recurrenceDraftRef.current = nextDraft;
                setRecurrenceDraft(nextDraft);
            })
            .catch(() => {
                if (!cancelled) setRecurrenceError('Unable to load recurrence.');
            });

        return () => {
            cancelled = true;
        };
    }, [selectedTask]);
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

    const neutralCalendarColor = theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(26, 26, 46, 0.10)';

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
            backgroundColor: event.status === 'CANCELLED'
                ? `${theme.palette.text.disabled}30`
                : event.status === 'TENTATIVE'
                    ? `${theme.palette.primary.main}70`
                    : theme.palette.primary.main,
            borderColor: event.status === 'CANCELLED'
                ? theme.palette.text.disabled
                : theme.palette.primary.main,
            textColor: event.status === 'CANCELLED'
                ? theme.palette.text.secondary
                : theme.palette.primary.contrastText,
            classNames: [event.status === 'CANCELLED'
                ? 'calendar-cancelled-event'
                : event.status === 'TENTATIVE'
                    ? 'calendar-tentative-event'
                    : 'calendar-accent-event'],
            extendedProps: {
                eventType: 'calendarEvent',
                calendarEventId: event.id,
                status: event.status,
                fullDescription: `${event.description || event.title} · ${event.status.toLowerCase()}`,
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
                            .map(task => new Date(task.scheduledPerformDateTime!).toISOString().split('T')[0]);
                        return groupTaskDates.map(date => [`${group.groupId}-${date}`, { group, date }] as const);
                    })
            ).values()).map(({ group, date }) => ({
                id: `group-${group.groupId}-${date}`,
                title: group.name,
                date,
                groupId: group.groupId,
                backgroundColor: neutralCalendarColor,
                borderColor: 'transparent',
                textColor: theme.palette.text.primary,
                classNames: ['calendar-neutral-event'],
                extendedProps: {
                    eventType: 'taskGroup',
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
                        date: new Date(task.scheduledPerformDateTime!).toISOString().split('T')[0],
                        backgroundColor: neutralCalendarColor,
                        borderColor: 'transparent',
                        textColor: theme.palette.text.primary,
                        classNames: ['calendar-neutral-event'],
                        extendedProps: {
                            eventType: 'task',
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
                const value = statEventValue(definition, entry.value);
                const color = definition.type === 'BOOLEAN'
                    ? theme.palette[getBooleanChoiceColor(definition, entry.value === 1 ? 1 : 0)].main
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
                        date: entry.date,
                        fullDescription: `${definition.name}: ${value}`,
                    },
                }];
            })
            : [];

        return [...eventEntries, ...groupEvents, ...taskEvents, ...statEvents];
    }, [availableStatDefinitions, calendarRange.end, calendarRange.start, calendarTasks, events, hasVisibleStats, neutralCalendarColor, selectedStatIdsForDisplay, showTasks, statEntries, tasks, taskGroupByTaskId, theme.palette]);

    const renderEventContent = useCallback((arg: EventContentArg) => {
        const eventType = arg.event.extendedProps.eventType;
        const isTaskEntity = eventType === 'task' || eventType === 'taskGroup';
        const isCalendarEvent = eventType === 'calendarEvent';
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
                {isCalendarEvent && !arg.event.allDay && arg.event.start && (
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
        setEditingDate(arg.dateStr);
        setActiveTab('event');
        setEditingDialogOpen(true);
    }, []);

    const closeEditingDialog = useCallback(() => {
        setEditingDialogOpen(false);
        setActiveTab('event');
    }, []);

    const openTemplateCreation = useCallback((sourceDate?: string) => {
        setTemplateSourceDate(sourceDate ?? (editingDialogOpen ? editingDate : null) ?? format(new Date(), 'yyyy-MM-dd'));
        setTemplateActionError(null);
        setTemplateCreationOpen(true);
        setEditingDialogOpen(false);
    }, [editingDate, editingDialogOpen]);

    const handleTemplateDrop = useCallback(async (templateId: string, date: string) => {
        if (applyingTemplateRef.current !== null) return;

        applyingTemplateRef.current = templateId;
        setApplyingTemplateId(templateId);
        setTemplateActionError(null);
        try {
            await onApplyDayTemplateRef.current(templateId, date);
        } catch (error) {
            console.error('Failed to apply day template:', error);
            setTemplateActionError('Unable to apply that template. Please try again.');
        } finally {
            applyingTemplateRef.current = null;
            setApplyingTemplateId(null);
        }
    }, []);

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
            setSelectedEventId(typeof calendarEventId === 'string' ? calendarEventId : arg.event.id);
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

    const handleTaskSubmit = useCallback((taskToCreate: TaskToCreate) => {
        let finalDateTime = taskToCreate.scheduledPerformDateTime;

        if (!finalDateTime || !finalDateTime.includes('T')) {
            finalDateTime = `${editingDate}T12:00:00`;
        }

        const finalTask: TaskToCreate = {
            ...taskToCreate,
            scheduledPerformDateTime: finalDateTime
        };

        onCreateTask(finalTask);
        setEditingDialogOpen(false);
    }, [editingDate, onCreateTask]);

    const closeTaskDialog = useCallback(() => {
        setTaskDialogOpen(false);
        setTaskSaving(false);
    }, []);

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
        const previousDraft = recurrenceDraftRef.current;
        const requestId = recurrenceRequestIdRef.current + 1;
        recurrenceRequestIdRef.current = requestId;
        recurrenceDraftRef.current = nextDraft;
        setRecurrenceDraft(nextDraft);
        setRecurrenceError(null);

        const persist = async () => {
            if (requestId !== recurrenceRequestIdRef.current) return;
            const currentSeries = taskSeriesRef.current;

            if (nextDraft.recurrenceFrequency === 'NONE') {
                if (!currentSeries?.active) return;
                await taskService.stopTaskSeries(currentSeries.seriesId);
                taskSeriesRef.current = { ...currentSeries, active: false };
                if (requestId !== recurrenceRequestIdRef.current) return;
                void onRefreshTasks?.();
                return;
            }

            if (!taskDraft?.scheduledPerformDateTime) return;
            const savedSeries = currentSeries
                ? await taskService.updateTaskSeries(currentSeries.seriesId, nextDraft, true)
                : await taskService.startTaskRecurrence(selectedTask.taskId, nextDraft);
            taskSeriesRef.current = savedSeries;
            if (requestId !== recurrenceRequestIdRef.current) return;
            void onRefreshTasks?.();
        };

        recurrenceMutationRef.current = recurrenceMutationRef.current
            .catch(() => undefined)
            .then(persist)
            .catch(error => {
                if (requestId !== recurrenceRequestIdRef.current) return;
                recurrenceDraftRef.current = previousDraft;
                setRecurrenceDraft(previousDraft);
                setRecurrenceError(error instanceof Error
                    ? error.message
                    : 'Unable to update recurrence.');
            });
    };

    const handleTaskSave = useCallback(async () => {
        if (!selectedTask || !taskDraft) return;

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
            closeTaskDialog();
        } catch (error) {
            console.error('Failed to update task from month calendar:', error);
            setTaskSaveError('Failed to save task changes. Please try again.');
        } finally {
            setTaskSaving(false);
        }
    }, [closeTaskDialog, onUpdateTask, selectedTask, taskDraft]);

    return (
        <>
            <HoverCardBox height="100%" hover={false}>
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
                            onDragStart={() => setTemplateActionError(null)}
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
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            '&:hover': {
                                background: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                transform: 'scale(1.01)',
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
                            boxShadow: theme.shadows[2],
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            '&:hover': {
                                boxShadow: theme.shadows[4],
                                transform: 'translateY(-1px)',
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
                            backgroundColor: `${neutralCalendarColor} !important`,
                            borderColor: `${neutralCalendarColor} !important`,
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
                            borderRadius: '14px',
                            overflow: 'hidden',
                        },
                        '& .fc-popover-header': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.03)',
                            color: theme.palette.text.primary,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            padding: '10px 12px',
                        },
                        '& .fc-popover-body': {
                            backgroundColor: `${theme.palette.background.default} !important`,
                            padding: '6px',
                        },
                        '& .fc-more-popover .fc-daygrid-event-harness': {
                            marginBottom: '4px',
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
                            eventContent={renderEventContent}
                            eventOrder="groupOrder,start,title"
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
                                right: ''
                            }}
                            buttonText={{
                                today: 'Today',
                            }}
                        />
                    </Box>
                        </Box>
                    )}
                </Box>
            </HoverCardBox>

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
                    {(showTasks || (hasVisibleStats && !isFutureDate)) && (
                        <Tabs
                            value={activeTab}
                            onChange={(_, value: CreateTab) => setActiveTab(value)}
                            sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
                            variant="fullWidth"
                        >
                            <Tab value="event" label="Event" />
                            {showTasks && <Tab value="task" label="Task" />}
                            {hasVisibleStats && !isFutureDate && <Tab value="stats" label="Stats" />}
                        </Tabs>
                    )}
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
                    {activeTab === 'task' && showTasks && (
                        <Box sx={{ p: 2 }}>
                            <SmartTaskInput
                                onSubmit={handleTaskSubmit}
                                initialDate={editingDate || undefined}
                                autoFocus={activeTab === 'task'}
                            />
                        </Box>
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
                onSave={onCreateDayTemplate}
                onClose={() => setTemplateCreationOpen(false)}
            />

            <Dialog
                open={selectedEventDialogOpen}
                onClose={() => setSelectedEventDialogOpen(false)}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 180, exit: 140 }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{selectedCalendarEvent?.title || 'Event details'}</DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {selectedCalendarEvent && (
                        <CalendarEventForm
                            key={selectedCalendarEvent.id}
                            initialDate={selectedCalendarEvent.startDate
                                ?? format(new Date(selectedCalendarEvent.startTime!), 'yyyy-MM-dd')}
                            event={selectedCalendarEvent}
                            onSave={async event => {
                                await onUpdateEvent(selectedCalendarEvent.id, event);
                                setSelectedEventDialogOpen(false);
                            }}
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
                onClose={closeTaskDialog}
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
                                        {!selectedTask.parentId && (
                                            <TaskRecurrencePicker
                                                value={recurrenceDraft}
                                                onChange={handleTaskRecurrenceChange}
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
                                                    />
                                                )}
                                                <AppDateField
                                                    label="Repeat until (optional)"
                                                    value={recurrenceDraft.recurrenceEndDate ?? ''}
                                                    onChange={recurrenceEndDate => handleTaskRecurrenceChange({
                                                        ...recurrenceDraft,
                                                        recurrenceEndDate: recurrenceEndDate || null,
                                                    })}
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
                <DialogActions>
                    <Button onClick={closeTaskDialog}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleTaskSave()}
                        disabled={taskSaving || !(taskDraft?.name ?? '').trim()}
                    >
                        {taskSaving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
