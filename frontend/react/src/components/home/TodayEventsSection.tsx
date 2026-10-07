import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { keyframes } from '@mui/system';
import { alpha, type Theme } from '@mui/material/styles';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    Chip,
    Collapse,
    FormControlLabel,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Popover,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { expandCalendarEvent } from '../calendar/recurrence';
import { TaskReminderPicker } from '../task/TaskReminderPicker';
import { AppTimeField } from '../input/AppPickerFields';
import { eventService } from '../../services/api';
import { getHomeTodayEventsExpanded, setHomeTodayEventsExpanded } from '../../services/utils/homePreferences';
import { readEventTimePreferences, saveEventTimePreferences } from '../../services/utils/inputPreferences';
import {
    CalendarEvent,
    CalendarEventInput,
    CalendarEventOccurrenceMoveInput,
    CalendarEventStatus,
} from '../../types/CalendarEvent';

type TodayEvent = {
    id: string;
    event: CalendarEvent;
    occurrenceKey: string;
    occurrenceDate: string;
    allDay: boolean;
    start: Date | null;
    end: Date | null;
    status: CalendarEventStatus;
};

type TodayEventCardProps = {
    item: TodayEvent;
    dayStart: Date;
    pendingCreation: boolean;
    onEventUpdated: (event: CalendarEvent) => void;
    onEventDeleted: (eventId: string) => void;
};

type DeleteRequest = {
    scope: 'occurrence' | 'event';
    anchorPosition: { top: number; left: number };
};

const EVENT_STATUSES: CalendarEventStatus[] = ['CONFIRMED', 'TENTATIVE', 'CANCELLED'];
const NEW_EVENT_STATUSES: CalendarEventStatus[] = ['CONFIRMED', 'TENTATIVE'];
const OPTIMISTIC_EVENT_ID_PREFIX = 'home-event-optimistic-';
const HOME_SECTION_AUTO_SCROLL_MS = 320;
let optimisticEventSequence = 0;

function findVerticalScrollContainer(element: HTMLElement): HTMLElement | null {
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

function eventStatusLabel(status: CalendarEventStatus): string {
    if (status === 'TENTATIVE') return 'Tentative';
    if (status === 'CANCELLED') return 'Cancelled';
    return 'Confirmed';
}

function eventStatusColor(status: CalendarEventStatus, theme: Theme): string {
    if (status === 'TENTATIVE') return theme.palette.mode === 'dark' ? '#d9bc72' : '#ad7c2e';
    if (status === 'CANCELLED') return theme.palette.error.main;
    return theme.palette.primary.main;
}

function eventTimeColor(theme: Theme): string {
    return theme.palette.mode === 'light'
        ? alpha(theme.palette.text.primary, 0.8)
        : theme.palette.text.secondary;
}

function eventsForToday(events: CalendarEvent[], dayStart: Date): TodayEvent[] {
    const dayEnd = addDays(dayStart, 1);
    const todayKey = format(dayStart, 'yyyy-MM-dd');
    const todayEvents: TodayEvent[] = [];

    events.forEach(event => {
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

function eventTimeLabel(event: TodayEvent, dayStart: Date): string {
    if (event.allDay) return 'All day';
    if (!event.start || !event.end) return '';

    const dayEnd = addDays(dayStart, 1);
    if (event.start < dayStart && event.end >= dayEnd) return 'Continues all day';
    if (event.start < dayStart) return `Until ${format(event.end, 'h:mm a')}`;
    if (event.end >= dayEnd) return `From ${format(event.start, 'h:mm a')} · continues`;
    const samePeriod = format(event.start, 'a') === format(event.end, 'a');
    return `${format(event.start, samePeriod ? 'h:mm' : 'h:mm a')} – ${format(event.end, 'h:mm a')}`;
}

function eventInput(event: CalendarEvent): CalendarEventInput {
    return {
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

function createOptimisticEvent(input: CalendarEventInput): CalendarEvent {
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

function applyTime(value: Date, time: string): Date | null {
    if (!/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    if (hours > 23 || minutes > 59) return null;

    const result = new Date(value);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

function oneHourAfter(time: string): string | null {
    if (!/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    if (hours > 23 || minutes > 59) return null;
    const totalMinutes = (hours * 60 + minutes + 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function defaultEventTimes(): { start: string; end: string } {
    const remembered = readEventTimePreferences();
    const start = remembered.startTime ?? '17:00';
    let end = remembered.endTime ?? oneHourAfter(start) ?? '18:00';
    if (end === start) end = oneHourAfter(start) ?? '18:00';
    return { start, end };
}

function timeRangeLabel(startTime: string, endTime: string): string {
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

const eventDraftReveal = keyframes`
    from { opacity: 0; transform: translateY(-5px) scale(0.99); }
    to { opacity: 1; transform: translateY(0) scale(1); }
`;

function eventDate(date: string | null, time: string | null, fallback: string): string {
    if (date) return date;
    return time ? format(new Date(time), 'yyyy-MM-dd') : fallback;
}

function applyDateAndTime(date: string, time: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const result = new Date(`${date}T${time}:00`);
    return Number.isNaN(result.getTime()) ? null : result;
}

function TodayEventCard({ item, dayStart, pendingCreation, onEventUpdated, onEventDeleted }: TodayEventCardProps) {
    const [editingName, setEditingName] = useState(false);
    const [localName, setLocalName] = useState(item.event.title ?? '');
    const [nameOverride, setNameOverride] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState(false);
    const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
    const [statusOverride, setStatusOverride] = useState<CalendarEventStatus | null>(null);
    const [reminderOverride, setReminderOverride] = useState<number | null | undefined>(undefined);
    const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const [reminderEditorPosition, setReminderEditorPosition] = useState<{ top: number; left: number } | null>(null);
    const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
    const [deleteError, setDeleteError] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [optimisticallyDeleted, setOptimisticallyDeleted] = useState(false);
    const [timeAnchorEl, setTimeAnchorEl] = useState<HTMLElement | null>(null);
    const [startTimeDraft, setStartTimeDraft] = useState('');
    const [endTimeDraft, setEndTimeDraft] = useState('');
    const [allDayDraft, setAllDayDraft] = useState(item.allDay);
    const [savingTime, setSavingTime] = useState(false);
    const [timeError, setTimeError] = useState(false);
    const [timeOverride, setTimeOverride] = useState<Pick<TodayEvent, 'allDay' | 'start' | 'end'> | null>(null);
    const timeSaveInFlightRef = useRef(false);
    const nameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const savingNameRef = useRef(false);
    const titleRequestIdRef = useRef(0);
    const statusRequestIdRef = useRef(0);
    const reminderRequestIdRef = useRef(0);
    const displayStatus = statusOverride ?? item.status;
    const displayedItem = timeOverride ? { ...item, ...timeOverride } : item;
    const reminderValue = reminderOverride !== undefined
        ? reminderOverride
        : item.event.reminderMinutesBefore;

    useEffect(() => {
        if (statusOverride === item.status) setStatusOverride(null);
    }, [item.status, statusOverride]);

    useEffect(() => {
        if (reminderOverride === item.event.reminderMinutesBefore) setReminderOverride(undefined);
    }, [item.event.reminderMinutesBefore, reminderOverride]);

    useEffect(() => {
        if (!editingName && !savingName) setLocalName(item.event.title ?? '');
    }, [editingName, item.event.title, savingName]);

    useEffect(() => {
        if (!editingName || !nameInputRef.current) return;
        const input = nameInputRef.current;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, [editingName]);

    const commitName = () => {
        if (!editingName || savingNameRef.current) return;
        const title = localName.trim();
        const originalTitle = item.event.title ?? '';

        if (!title || title === originalTitle) {
            setLocalName(originalTitle);
            setEditingName(false);
            return;
        }

        const requestId = titleRequestIdRef.current + 1;
        titleRequestIdRef.current = requestId;
        savingNameRef.current = true;
        setSavingName(true);
        setNameError(false);
        setLocalName(title);
        setNameOverride(title);
        setEditingName(false);
        void eventService.updateEvent(item.event.id, { ...eventInput(item.event), title })
            .then(updated => {
                if (titleRequestIdRef.current === requestId) {
                    onEventUpdated(updated);
                    setNameOverride(null);
                }
            })
            .catch(error => {
                console.error('Failed to update calendar event title:', error);
                if (titleRequestIdRef.current === requestId) {
                    setLocalName(originalTitle);
                    setNameOverride(null);
                    setNameError(true);
                }
            })
            .finally(() => {
                if (titleRequestIdRef.current === requestId) {
                    savingNameRef.current = false;
                    setSavingName(false);
                }
            });
    };

    const cancelNameEdit = () => {
        if (savingNameRef.current) return;
        setLocalName(item.event.title ?? '');
        setEditingName(false);
    };

    const openTimePicker = (anchor: HTMLElement) => {
        const rememberedTimes = readEventTimePreferences();
        setStartTimeDraft(item.start ? format(item.start, 'HH:mm') : rememberedTimes.startTime ?? '17:00');
        setEndTimeDraft(item.end ? format(item.end, 'HH:mm') : rememberedTimes.endTime ?? '18:00');
        setAllDayDraft(item.allDay);
        setTimeError(false);
        setTimeAnchorEl(anchor);
    };

    const saveTime = async () => {
        if (timeSaveInFlightRef.current) return;
        const startDate = eventDate(item.event.startDate, item.event.startTime, item.occurrenceDate);
        const endDate = eventDate(item.event.endDate, item.event.endTime, item.occurrenceDate);
        if (allDayDraft === item.allDay && (allDayDraft
            || (item.start && item.end
                && startTimeDraft === format(item.start, 'HH:mm')
                && endTimeDraft === format(item.end, 'HH:mm')))) {
            setTimeAnchorEl(null);
            return;
        }

        let nextStart: Date | null = null;
        let nextEnd: Date | null = null;
        if (!allDayDraft) {
            nextStart = item.allDay
                ? applyDateAndTime(startDate, startTimeDraft)
                : item.start ? applyTime(item.start, startTimeDraft) : null;
            nextEnd = item.allDay
                ? applyDateAndTime(endDate, endTimeDraft)
                : item.end ? applyTime(item.end, endTimeDraft) : null;
            if (!nextStart || !nextEnd || nextEnd <= nextStart) {
                setTimeError(true);
                return;
            }
        }

        timeSaveInFlightRef.current = true;
        setSavingTime(true);
        setTimeError(false);
        setTimeOverride({
            allDay: allDayDraft,
            start: allDayDraft ? null : nextStart,
            end: allDayDraft ? null : nextEnd,
        });

        try {
            let updated: CalendarEvent;
            if (allDayDraft !== item.allDay) {
                updated = await eventService.updateEvent(item.event.id, {
                    ...eventInput(item.event),
                    allDay: allDayDraft,
                    startDate: allDayDraft ? startDate : null,
                    endDate: allDayDraft ? endDate : null,
                    startTime: allDayDraft ? null : nextStart!.toISOString(),
                    endTime: allDayDraft ? null : nextEnd!.toISOString(),
                });
            } else if (item.event.recurrenceFrequency !== 'NONE') {
                const move: CalendarEventOccurrenceMoveInput = {
                    startDate: null,
                    endDate: null,
                    startTime: nextStart!.toISOString(),
                    endTime: nextEnd!.toISOString(),
                };
                updated = await eventService.moveEventOccurrence(
                    item.event.id,
                    item.occurrenceKey,
                    move,
                );
            } else {
                updated = await eventService.updateEvent(item.event.id, {
                    ...eventInput(item.event),
                    startDate: null,
                    endDate: null,
                    startTime: nextStart!.toISOString(),
                    endTime: nextEnd!.toISOString(),
                });
            }
            if (!allDayDraft) saveEventTimePreferences(startTimeDraft, endTimeDraft);
            onEventUpdated(updated);
            setTimeOverride(null);
            setTimeAnchorEl(null);
        } catch (error) {
            console.error('Failed to update calendar event time:', error);
            setTimeOverride(null);
            setTimeError(true);
        } finally {
            timeSaveInFlightRef.current = false;
            setSavingTime(false);
        }
    };

    const updateStatus = async (status: CalendarEventStatus) => {
        setStatusAnchorEl(null);
        if (status === displayStatus) return;
        const requestId = statusRequestIdRef.current + 1;
        statusRequestIdRef.current = requestId;
        setStatusOverride(status);
        try {
            const updated = item.event.recurrenceFrequency !== 'NONE'
                ? await eventService.updateEventOccurrenceStatus(item.event.id, item.occurrenceKey, status)
                : await eventService.updateEvent(item.event.id, { ...eventInput(item.event), status });
            if (statusRequestIdRef.current === requestId) onEventUpdated(updated);
        } catch (error) {
            console.error('Failed to update calendar event status:', error);
            if (statusRequestIdRef.current === requestId) setStatusOverride(null);
        }
    };

    const updateReminder = async (minutes: number | null) => {
        setContextMenuPosition(null);
        setReminderEditorPosition(null);
        if (minutes === reminderValue) return;
        const requestId = reminderRequestIdRef.current + 1;
        reminderRequestIdRef.current = requestId;
        setReminderOverride(minutes);
        try {
            const updated = await eventService.updateEvent(item.event.id, {
                ...eventInput(item.event),
                reminderMinutesBefore: minutes,
            });
            if (reminderRequestIdRef.current === requestId) onEventUpdated(updated);
        } catch (error) {
            console.error('Failed to update calendar event reminder:', error);
            if (reminderRequestIdRef.current === requestId) setReminderOverride(undefined);
        }
    };

    const requestDelete = (scope: DeleteRequest['scope'], anchor: HTMLElement) => {
        const rect = anchor.getBoundingClientRect();
        setContextMenuPosition(null);
        setDeleteError(false);
        setDeleteRequest({ scope, anchorPosition: { top: rect.bottom, left: rect.left } });
    };

    const confirmDelete = async () => {
        if (!deleteRequest || deleting) return;
        setDeleting(true);
        setDeleteError(false);
        setOptimisticallyDeleted(true);
        try {
            if (deleteRequest.scope === 'occurrence') {
                const updated = await eventService.deleteEventOccurrence(item.event.id, item.occurrenceKey);
                onEventUpdated(updated);
            } else {
                await eventService.deleteEvent(item.event.id);
                onEventDeleted(item.event.id);
            }
            setDeleteRequest(null);
        } catch (error) {
            console.error('Failed to delete calendar event:', error);
            setOptimisticallyDeleted(false);
            setDeleteError(true);
        } finally {
            setDeleting(false);
        }
    };

    if (optimisticallyDeleted) return null;

    return (
        <Box
            onContextMenu={contextEvent => {
                contextEvent.preventDefault();
                if (pendingCreation) return;
                setContextMenuPosition({ top: contextEvent.clientY, left: contextEvent.clientX });
            }}
            aria-busy={pendingCreation || undefined}
            sx={theme => ({
                minWidth: 0,
                p: 1.25,
                pl: 2,
                border: '1px solid',
                borderColor: eventStatusColor(displayStatus, theme),
                borderStyle: displayStatus === 'TENTATIVE'
                    ? 'dashed'
                    : displayStatus === 'CANCELLED' ? 'dotted' : 'solid',
                borderRadius: 2,
                backgroundColor: theme.palette.background.default,
            })}
        >
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gridTemplateRows: 'auto auto',
                alignItems: 'stretch',
                columnGap: 1,
                rowGap: 0.35,
                minWidth: 0,
            }}>
                <Box sx={{
                    gridColumn: 1,
                    gridRow: '1 / span 2',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    minWidth: 0,
                    textAlign: 'left',
                }}>
                    <Box
                        component="span"
                        data-event-name="true"
                        onClick={clickEvent => {
                            if (pendingCreation) return;
                            clickEvent.stopPropagation();
                            setNameError(false);
                            setEditingName(true);
                        }}
                        sx={{
                            display: 'inline-block',
                            position: 'relative',
                            width: 'max-content',
                            maxWidth: 'calc(100% - 32px)',
                            boxSizing: 'border-box',
                            textAlign: 'left',
                            cursor: 'text',
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                right: -32,
                                width: 32,
                                height: '100%',
                            },
                        }}
                    >
                        <Typography
                            component="span"
                            display="inline"
                            sx={{
                                fontSize: '1.1rem',
                                lineHeight: 1.35,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                textAlign: 'left',
                                color: 'text.primary',
                                visibility: editingName ? 'hidden' : 'visible',
                                textDecoration: displayStatus === 'CANCELLED' ? 'line-through' : 'none',
                            }}
                        >
                                {editingName ? localName : (nameOverride ?? (item.event.title || 'Untitled event'))}
                        </Typography>
                        {editingName && (
                            <TextField
                                value={localName}
                                inputRef={nameInputRef}
                                autoComplete="off"
                                onClick={inputEvent => inputEvent.stopPropagation()}
                                onChange={inputEvent => setLocalName(inputEvent.target.value)}
                                onBlur={commitName}
                                onKeyDown={keyEvent => {
                                    if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
                                        keyEvent.preventDefault();
                                        commitName();
                                    }
                                    if (keyEvent.key === 'Escape') {
                                        keyEvent.preventDefault();
                                        cancelNameEdit();
                                    }
                                }}
                                variant="standard"
                                autoFocus
                                fullWidth
                                multiline
                                minRows={1}
                                maxRows={3}
                                InputProps={{ disableUnderline: true }}
                                inputProps={{ 'data-event-name-input': 'true', draggable: false, readOnly: savingName }}
                                sx={theme => ({
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                    width: 'auto',
                                    '& .MuiInputBase-root': { height: '100%', padding: 0 },
                                    '& .MuiInputBase-input': {
                                        color: theme.palette.text.primary,
                                        WebkitTextFillColor: theme.palette.text.primary,
                                        fontSize: '1.1rem',
                                        lineHeight: 1.35,
                                        whiteSpace: 'pre-wrap',
                                        overflowWrap: 'anywhere',
                                        textAlign: 'left',
                                        padding: 0,
                                    },
                                })}
                            />
                        )}
                    </Box>
                    {nameError && (
                        <Typography variant="caption" color="error.main" role="status">
                            Couldn&apos;t save the event name.
                        </Typography>
                    )}
                </Box>

                <ButtonBase
                    aria-label={`Edit time for ${item.event.title}`}
                    disabled={pendingCreation || savingTime}
                    onClick={clickEvent => {
                        clickEvent.stopPropagation();
                        openTimePicker(clickEvent.currentTarget);
                    }}
                    sx={theme => ({
                        gridColumn: 2,
                        gridRow: 1,
                        justifySelf: 'end',
                        flexShrink: 0,
                        px: 0.75,
                        py: 0.2,
                        borderRadius: '16px',
                        color: eventTimeColor(theme),
                        fontSize: '0.875rem',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 140ms ease, color 140ms ease',
                        '&:hover': {
                            color: theme.palette.primary.main,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        },
                    })}
                >
                    {eventTimeLabel(displayedItem, dayStart)}
                </ButtonBase>

                <Chip
                    size="small"
                    label={eventStatusLabel(displayStatus)}
                    disabled={pendingCreation}
                    onClick={clickEvent => {
                        clickEvent.stopPropagation();
                        setStatusAnchorEl(clickEvent.currentTarget);
                    }}
                    aria-label={`Change event status, currently ${eventStatusLabel(displayStatus)}`}
                    sx={theme => {
                        const color = eventStatusColor(displayStatus, theme);
                        return {
                            gridColumn: 2,
                            gridRow: 2,
                            justifySelf: 'center',
                            flexShrink: 0,
                            height: 22,
                            color,
                            bgcolor: alpha(color, 0.1),
                            fontWeight: 600,
                            cursor: 'pointer',
                        };
                    }}
                />
            </Box>

            <Menu
                anchorEl={statusAnchorEl}
                open={Boolean(statusAnchorEl)}
                onClose={() => setStatusAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                {EVENT_STATUSES.map(status => (
                    <MenuItem key={status} selected={status === displayStatus} onClick={() => void updateStatus(status)}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                            <Box sx={theme => ({
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                bgcolor: eventStatusColor(status, theme),
                            })} />
                        </ListItemIcon>
                        {eventStatusLabel(status)}
                    </MenuItem>
                ))}
            </Menu>

            <Menu
                open={Boolean(contextMenuPosition)}
                onClose={() => setContextMenuPosition(null)}
                anchorReference="anchorPosition"
                anchorPosition={contextMenuPosition ?? undefined}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                MenuListProps={{ dense: true }}
                slotProps={{ paper: { sx: { maxWidth: 'calc(100vw - 24px)' } } }}
            >
                <MenuItem onClick={() => {
                    if (!contextMenuPosition) return;
                    const position = contextMenuPosition;
                    setContextMenuPosition(null);
                    window.setTimeout(() => setReminderEditorPosition(position), 0);
                }}>
                    <ListItemIcon><NotificationsNoneOutlinedIcon fontSize="small" /></ListItemIcon>
                    {reminderValue == null ? 'Set reminder' : 'Edit reminder'}
                </MenuItem>
                {item.event.recurrenceFrequency !== 'NONE' && (
                    <MenuItem
                        onClick={clickEvent => requestDelete('occurrence', clickEvent.currentTarget)}
                        sx={{
                            '&:hover': {
                                color: 'error.main',
                                '& .MuiListItemIcon-root': { color: 'inherit' },
                            },
                        }}
                    >
                        <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                        Delete occurrence
                    </MenuItem>
                )}
                <MenuItem
                    onClick={clickEvent => requestDelete('event', clickEvent.currentTarget)}
                    sx={{
                        '&:hover': {
                            color: 'error.main',
                            '& .MuiListItemIcon-root': { color: 'inherit' },
                        },
                    }}
                >
                    <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                    {item.event.recurrenceFrequency !== 'NONE' ? 'Delete event series' : 'Delete event'}
                </MenuItem>
            </Menu>

            <Popover
                open={Boolean(reminderEditorPosition)}
                onClose={() => setReminderEditorPosition(null)}
                anchorReference="anchorPosition"
                anchorPosition={reminderEditorPosition ?? undefined}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 280,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                <Box onClick={clickEvent => clickEvent.stopPropagation()}>
                    <Typography variant="subtitle2" sx={{ mb: 1.25 }} noWrap>
                        {reminderValue == null ? 'Set reminder' : 'Edit reminder'}
                    </Typography>
                    <TaskReminderPicker
                        value={reminderValue}
                        targetLabel="event"
                        scheduledAt={item.start?.toISOString()}
                        disabled={!item.start}
                        onChange={minutes => void updateReminder(minutes)}
                    />
                </Box>
            </Popover>

            <Popover
                open={Boolean(timeAnchorEl)}
                anchorEl={timeAnchorEl}
                onClose={event => {
                    const target = (event as { target?: EventTarget | null }).target;
                    if (target instanceof Element && target.closest('.MuiPickersPopper-root, .MuiDialog-root')) return;
                    setTimeAnchorEl(null);
                    setTimeError(false);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 0,
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            boxShadow: 8,
                            backgroundImage: 'none',
                        },
                    },
                }}
            >
                <Box
                    onClick={clickEvent => clickEvent.stopPropagation()}
                >
                    <Stack direction="column" spacing={1.25} sx={{ p: 1.5, minWidth: 260 }}>
                        <FormControlLabel
                            control={<Switch
                                checked={allDayDraft}
                                onChange={event => {
                                    setAllDayDraft(event.target.checked);
                                    setTimeError(false);
                                }}
                                disabled={savingTime}
                            />}
                            label="All day"
                            sx={{ alignSelf: 'flex-start', m: 0 }}
                        />
                        {!allDayDraft && (
                            <>
                                <AppTimeField
                                    label="Start time"
                                    value={startTimeDraft}
                                    onChange={value => {
                                        setStartTimeDraft(value);
                                        const nextEndTime = oneHourAfter(value);
                                        if (nextEndTime) setEndTimeDraft(nextEndTime);
                                        setTimeError(false);
                                    }}
                                    disabled={savingTime}
                                    size="small"
                                />
                                <AppTimeField
                                    label="End time"
                                    value={endTimeDraft}
                                    onChange={value => {
                                        setEndTimeDraft(value);
                                        setTimeError(false);
                                    }}
                                    disabled={savingTime}
                                    size="small"
                                />
                            </>
                        )}
                    </Stack>
                    {timeError && (
                        <Alert severity="error" sx={{ mx: 1.5, mb: 1 }}>
                            Finish time must be after the start time.
                        </Alert>
                    )}
                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ px: 1.5, pb: 1.25 }}>
                        <Button
                            size="small"
                            onClick={() => {
                                setTimeAnchorEl(null);
                                setTimeError(false);
                            }}
                            disabled={savingTime}
                        >
                            Cancel
                        </Button>
                        <Button size="small" variant="contained" onClick={() => void saveTime()} disabled={savingTime}>
                            Okay
                        </Button>
                    </Stack>
                </Box>
            </Popover>

            <Popover
                open={Boolean(deleteRequest)}
                onClose={() => !deleting && setDeleteRequest(null)}
                anchorReference="anchorPosition"
                anchorPosition={deleteRequest?.anchorPosition}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 270,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                <Typography variant="body2" sx={{ mb: 1.25 }}>
                    {deleteRequest?.scope === 'occurrence'
                        ? 'Delete this occurrence from your calendar?'
                        : item.event.recurrenceFrequency !== 'NONE'
                            ? 'Delete all occurrences of this event?'
                            : 'Delete this event from your calendar?'}
                </Typography>
                {deleteError && <Alert severity="error" sx={{ mb: 1 }}>Couldn&apos;t delete the event.</Alert>}
                <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                    <Button size="small" onClick={() => setDeleteRequest(null)} disabled={deleting}>
                        Keep event
                    </Button>
                    <Button
                        size="small"
                        color="error"
                        variant="contained"
                        onClick={() => void confirmDelete()}
                        disabled={deleting}
                    >
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </Stack>
            </Popover>
        </Box>
    );
}

export function TodayEventsSection() {
    const [initialEvents] = useState(() => eventService.getLastKnownEvents());
    const [events, setEvents] = useState<CalendarEvent[]>(() => initialEvents ?? []);
    const [loading, setLoading] = useState(() => initialEvents === undefined);
    const [expanded, setExpanded] = useState(getHomeTodayEventsExpanded);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventError, setNewEventError] = useState(false);
    const [creatingEventRequest, setCreatingEventRequest] = useState(false);
    const [newEventTimes, setNewEventTimes] = useState(defaultEventTimes);
    const [newEventAllDay, setNewEventAllDay] = useState(false);
    const [newEventStatus, setNewEventStatus] = useState<CalendarEventStatus>('CONFIRMED');
    const [newEventTimeAnchorEl, setNewEventTimeAnchorEl] = useState<HTMLElement | null>(null);
    const [newEventStatusAnchorEl, setNewEventStatusAnchorEl] = useState<HTMLElement | null>(null);
    const [newEventTimeError, setNewEventTimeError] = useState(false);
    const sectionRef = useRef<HTMLElement | null>(null);
    const scrollToExpandedSectionRef = useRef(false);
    const scrollAnimationFrameRef = useRef<number | null>(null);
    const newEventTimePickerOpenRef = useRef(false);
    const createEventInFlightRef = useRef(false);
    const cancelCreateEventRef = useRef(false);

    useEffect(() => {
        setHomeTodayEventsExpanded(expanded);
    }, [expanded]);

    useEffect(() => {
        const cancelScroll = () => {
            if (scrollAnimationFrameRef.current === null) return;
            cancelAnimationFrame(scrollAnimationFrameRef.current);
            scrollAnimationFrameRef.current = null;
        };
        window.addEventListener('wheel', cancelScroll, { passive: true });
        window.addEventListener('touchstart', cancelScroll, { passive: true });
        window.addEventListener('pointerdown', cancelScroll, { passive: true });
        window.addEventListener('keydown', cancelScroll);
        return () => {
            cancelScroll();
            window.removeEventListener('wheel', cancelScroll);
            window.removeEventListener('touchstart', cancelScroll);
            window.removeEventListener('pointerdown', cancelScroll);
            window.removeEventListener('keydown', cancelScroll);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        eventService.getEvents()
            .then(result => {
                if (!cancelled) {
                    setEvents(current => [
                        ...result,
                        ...current.filter(event => event.id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX)),
                    ]);
                }
            })
            .catch(error => {
                console.error("Couldn't load today's calendar events:", error);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const [dayStart] = useState(() => startOfDay(new Date()));
    const todayEvents = useMemo(() => eventsForToday(events, dayStart), [dayStart, events]);
    const updateEventInState = (updatedEvent: CalendarEvent) => {
        setEvents(current => current.map(event => event.id === updatedEvent.id ? updatedEvent : event));
    };
    const removeEventFromState = (eventId: string) => {
        setEvents(current => current.filter(event => event.id !== eventId));
    };

    const createTodayEvent = async () => {
        if (cancelCreateEventRef.current) {
            cancelCreateEventRef.current = false;
            return;
        }
        if (!creatingEvent || createEventInFlightRef.current) return;

        const title = newEventTitle.trim();
        if (!title) {
            setCreatingEvent(false);
            setNewEventTitle('');
            return;
        }

        const startDate = format(dayStart, 'yyyy-MM-dd');
        const endDate = newEventTimes.end <= newEventTimes.start
            ? format(addDays(dayStart, 1), 'yyyy-MM-dd')
            : startDate;
        const start = applyDateAndTime(startDate, newEventTimes.start);
        const end = newEventAllDay ? null : applyDateAndTime(endDate, newEventTimes.end);
        if (!newEventAllDay && (!start || !end || end <= start)) {
            setNewEventTimeError(true);
            setNewEventError(false);
            return;
        }
        if (!newEventAllDay && (!start || !end)) {
            setNewEventError(true);
            return;
        }

        const input: CalendarEventInput = {
            title,
            description: '',
            allDay: newEventAllDay,
            startDate: newEventAllDay ? startDate : null,
            endDate: newEventAllDay ? startDate : null,
            startTime: newEventAllDay ? null : start!.toISOString(),
            endTime: newEventAllDay ? null : end!.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            status: newEventStatus,
            recurrenceFrequency: 'NONE',
            recurrenceEndDate: null,
            recurrenceInterval: null,
            recurrenceUnit: null,
            reminderMinutesBefore: null,
        };
        const optimisticEvent = createOptimisticEvent(input);

        createEventInFlightRef.current = true;
        setCreatingEventRequest(true);
        setNewEventError(false);
        setNewEventTitle(title);
        newEventTimePickerOpenRef.current = false;
        setNewEventTimeAnchorEl(null);
        setNewEventStatusAnchorEl(null);
        setEvents(current => [...current, optimisticEvent]);
        try {
            const createdEvent = await eventService.createEvent(input);
            setEvents(current => current.map(event => event.id === optimisticEvent.id ? createdEvent : event));
            if (!newEventAllDay) saveEventTimePreferences(newEventTimes.start, newEventTimes.end);
            setCreatingEvent(false);
            setNewEventTitle('');
        } catch (error) {
            console.error('Failed to create calendar event:', error);
            setEvents(current => current.filter(event => event.id !== optimisticEvent.id));
            setNewEventError(true);
        } finally {
            createEventInFlightRef.current = false;
            setCreatingEventRequest(false);
        }
    };

    const scrollExpandedSectionIntoView = () => {
        const section = sectionRef.current;
        const scrollContainer = section ? findVerticalScrollContainer(section) : null;
        if (!section || !scrollContainer) return;

        if (scrollAnimationFrameRef.current !== null) {
            cancelAnimationFrame(scrollAnimationFrameRef.current);
        }

        const isDocumentScroll = scrollContainer === document.scrollingElement;
        const sectionRect = section.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const viewportTop = isDocumentScroll ? 0 : containerRect.top + scrollContainer.clientTop;
        const viewportHeight = isDocumentScroll ? window.innerHeight : scrollContainer.clientHeight;
        const startScrollTop = isDocumentScroll ? window.scrollY : scrollContainer.scrollTop;
        const maxScrollTop = isDocumentScroll
            ? Math.max(document.body.scrollHeight, scrollContainer.scrollHeight) - viewportHeight
            : scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const targetScrollTop = Math.max(0, Math.min(
            maxScrollTop,
            startScrollTop + sectionRect.top - viewportTop - (viewportHeight - sectionRect.height) / 2,
        ));
        const scrollDistance = targetScrollTop - startScrollTop;
        if (Math.abs(scrollDistance) < 1) {
            scrollAnimationFrameRef.current = null;
            return;
        }

        let animationStart: number | null = null;
        const animateScroll = (timestamp: number) => {
            if (animationStart === null) animationStart = timestamp;
            const progress = Math.min((timestamp - animationStart) / HOME_SECTION_AUTO_SCROLL_MS, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            scrollContainer.scrollTop = startScrollTop + scrollDistance * easedProgress;
            if (progress < 1) {
                scrollAnimationFrameRef.current = requestAnimationFrame(animateScroll);
            } else {
                scrollAnimationFrameRef.current = null;
            }
        };
        scrollAnimationFrameRef.current = requestAnimationFrame(animateScroll);
    };

    return (
        <Box
            ref={sectionRef}
            component="section"
            aria-labelledby="today-events-heading"
            aria-busy={loading || undefined}
            sx={{ mt: 2, mb: 1 }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <ButtonBase
                    disableRipple
                    disabled={todayEvents.length === 0}
                    aria-expanded={expanded}
                    aria-controls="home-today-events-list"
                    onClick={() => {
                        if (todayEvents.length === 0) return;
                        scrollToExpandedSectionRef.current = !expanded;
                        setExpanded(!expanded);
                    }}
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0,
                        gap: 0,
                        px: 0.5,
                        py: 0.5,
                        borderRadius: 1,
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        '&:hover': { backgroundColor: 'transparent' },
                    }}
                >
                    <Box sx={{
                        width: 38,
                        height: 38,
                        p: 0,
                        mr: 0.5,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                    }}>
                        {expanded
                            ? <EventNoteOutlinedIcon color="primary" fontSize="small" />
                            : <EventAvailableOutlinedIcon color="primary" fontSize="small" />}
                    </Box>
                    <Typography id="today-events-heading" variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Today&apos;s events
                    </Typography>
                    <Box
                        aria-label={`${todayEvents.length} events`}
                        sx={theme => ({
                            ml: 0.75,
                            width: 22,
                            height: 22,
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: '50%',
                            color: theme.palette.primary.main,
                            backgroundColor: alpha(theme.palette.primary.main, 0.12),
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            lineHeight: 1,
                        })}
                    >
                        {todayEvents.length}
                    </Box>
                </ButtonBase>
                <IconButton
                    aria-label="Add event"
                    title="Add event"
                    size="small"
                    color="primary"
                    disabled={creatingEvent}
                    onClick={() => {
                        cancelCreateEventRef.current = false;
                        setNewEventError(false);
                        setNewEventTimeError(false);
                        setNewEventTitle('');
                        setNewEventTimes(defaultEventTimes());
                        setNewEventAllDay(false);
                        setNewEventStatus('CONFIRMED');
                        setNewEventTimeAnchorEl(null);
                        setNewEventStatusAnchorEl(null);
                        setCreatingEvent(true);
                        if (!expanded) scrollToExpandedSectionRef.current = true;
                        setExpanded(true);
                    }}
                    sx={{ width: 38, height: 38, p: 0, flexShrink: 0 }}
                >
                    <AddRoundedIcon fontSize="small" />
                </IconButton>
            </Box>

            <Collapse
                id="home-today-events-list"
                in={expanded}
                timeout={{ enter: 420, exit: 440 }}
                easing={{ enter: 'cubic-bezier(0.4, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                appear
                mountOnEnter
                onEntered={() => {
                    if (!scrollToExpandedSectionRef.current) return;
                    scrollToExpandedSectionRef.current = false;
                    scrollExpandedSectionIntoView();
                }}
            >
                <Box
                    sx={{
                        ml: 5.75,
                        mr: 2,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.75,
                        pt: 0.75,
                        opacity: expanded ? 1 : 0,
                        transform: expanded ? 'translateY(0)' : 'translateY(-2px)',
                        transition: expanded
                            ? 'opacity 260ms ease-in-out, transform 320ms ease-in-out'
                            : 'opacity 420ms ease-in-out, transform 420ms ease-in-out',
                        ...(todayEvents.length > 0 || creatingEvent ? {
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                left: -23,
                                top: -0.375,
                                bottom: 0,
                                borderLeft: '1px solid',
                                borderColor: 'divider',
                                pointerEvents: 'none',
                            },
                        } : {}),
                    }}
                >
                    {creatingEvent && !creatingEventRequest && (
                        <Box
                            sx={theme => ({
                                minWidth: 0,
                                p: 1.25,
                                pl: 2,
                                border: '1px solid',
                                borderColor: eventStatusColor(newEventStatus, theme),
                                borderStyle: newEventStatus === 'TENTATIVE'
                                    ? 'dashed'
                                    : newEventStatus === 'CANCELLED' ? 'dotted' : 'solid',
                                borderRadius: 2,
                                backgroundColor: theme.palette.background.default,
                                animation: `${eventDraftReveal} 180ms ease-out`,
                            })}
                        >
                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr) auto',
                                gridTemplateRows: 'auto auto',
                                alignItems: 'stretch',
                                columnGap: 1,
                                rowGap: 0.35,
                                minWidth: 0,
                            }}>
                                <Box sx={{
                                    gridColumn: 1,
                                    gridRow: '1 / span 2',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    minWidth: 0,
                                }}>
                                    <TextField
                                        value={newEventTitle}
                                        autoFocus
                                        autoComplete="off"
                                        placeholder="New event"
                                        onChange={changeEvent => setNewEventTitle(changeEvent.target.value)}
                                        onKeyDown={keyEvent => {
                                            if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
                                                keyEvent.preventDefault();
                                                void createTodayEvent();
                                            }
                                            if (keyEvent.key === 'Escape') {
                                                keyEvent.preventDefault();
                                                cancelCreateEventRef.current = true;
                                                setCreatingEvent(false);
                                                setNewEventTitle('');
                                                setNewEventError(false);
                                                setNewEventTimeError(false);
                                            }
                                        }}
                                        variant="standard"
                                        fullWidth
                                        multiline
                                        minRows={1}
                                        maxRows={3}
                                        InputProps={{ disableUnderline: true }}
                                        inputProps={{
                                            'aria-label': 'New event name',
                                            draggable: false,
                                            readOnly: creatingEventRequest,
                                        }}
                                        sx={{
                                            '& .MuiInputBase-root': { padding: 0 },
                                            '& .MuiInputBase-input': {
                                                color: 'text.primary',
                                                fontSize: '1.1rem',
                                                lineHeight: 1.35,
                                                whiteSpace: 'pre-wrap',
                                                overflowWrap: 'anywhere',
                                                textAlign: 'left',
                                                padding: 0,
                                            },
                                        }}
                                    />
                                    {(newEventError || newEventTimeError) && (
                                        <Typography variant="caption" color="error.main" role="status">
                                            {newEventError
                                                ? 'Couldn’t create the event.'
                                                : 'Finish time must be after the start time.'}
                                        </Typography>
                                    )}
                                </Box>

                                <ButtonBase
                                    aria-label="Edit new event time"
                                    onClick={clickEvent => {
                                        clickEvent.stopPropagation();
                                        setNewEventTimeAnchorEl(clickEvent.currentTarget);
                                        setNewEventTimeError(false);
                                    }}
                                    sx={theme => ({
                                        gridColumn: 2,
                                        gridRow: 1,
                                        justifySelf: 'end',
                                        flexShrink: 0,
                                        px: 0.75,
                                        py: 0.2,
                                        borderRadius: '16px',
                                        color: eventTimeColor(theme),
                                        fontSize: '0.875rem',
                                        textAlign: 'right',
                                        fontVariantNumeric: 'tabular-nums',
                                        whiteSpace: 'nowrap',
                                        transition: 'background-color 140ms ease, color 140ms ease',
                                        '&:hover': {
                                            color: theme.palette.primary.main,
                                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                        },
                                    })}
                                >
                                    {newEventAllDay
                                        ? 'All day'
                                        : timeRangeLabel(newEventTimes.start, newEventTimes.end)}
                                </ButtonBase>

                                <Chip
                                    size="small"
                                    label={eventStatusLabel(newEventStatus)}
                                    onClick={clickEvent => {
                                        clickEvent.stopPropagation();
                                        setNewEventStatusAnchorEl(clickEvent.currentTarget);
                                    }}
                                    aria-label={`Change new event status, currently ${eventStatusLabel(newEventStatus)}`}
                                    sx={theme => {
                                        const color = eventStatusColor(newEventStatus, theme);
                                        return {
                                            gridColumn: 2,
                                            gridRow: 2,
                                            justifySelf: 'center',
                                            flexShrink: 0,
                                            height: 22,
                                            color,
                                            bgcolor: alpha(color, 0.1),
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        };
                                    }}
                                />
                            </Box>

                            <Menu
                                anchorEl={newEventStatusAnchorEl}
                                open={Boolean(newEventStatusAnchorEl)}
                                onClose={() => setNewEventStatusAnchorEl(null)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                            >
                                {NEW_EVENT_STATUSES.map(status => (
                                    <MenuItem
                                        key={status}
                                        selected={status === newEventStatus}
                                        onClick={() => {
                                            setNewEventStatus(status);
                                            setNewEventStatusAnchorEl(null);
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 28 }}>
                                            <Box sx={theme => ({
                                                width: 9,
                                                height: 9,
                                                borderRadius: '50%',
                                                bgcolor: eventStatusColor(status, theme),
                                            })} />
                                        </ListItemIcon>
                                        {eventStatusLabel(status)}
                                    </MenuItem>
                                ))}
                            </Menu>

                            <Popover
                                open={Boolean(newEventTimeAnchorEl)}
                                anchorEl={newEventTimeAnchorEl}
                                onClose={event => {
                                    if (newEventTimePickerOpenRef.current) return;
                                    const target = (event as { target?: EventTarget | null }).target;
                                    if (target instanceof Element
                                        && target.closest('.MuiPickersPopper-root, .MuiDialog-root')) return;
                                    newEventTimePickerOpenRef.current = false;
                                    setNewEventTimeAnchorEl(null);
                                }}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                slotProps={{ paper: { sx: { p: 0, borderRadius: 3, border: '1px solid', borderColor: 'divider' } } }}
                            >
                                <Box
                                    onClick={clickEvent => clickEvent.stopPropagation()}
                                >
                                    <Stack direction="column" spacing={1.25} sx={{ p: 1.5, minWidth: 260 }}>
                                        <FormControlLabel
                                            control={<Switch
                                                checked={newEventAllDay}
                                                onChange={changeEvent => setNewEventAllDay(changeEvent.target.checked)}
                                            />}
                                            label="All day"
                                            sx={{ alignSelf: 'flex-start', m: 0 }}
                                        />
                                        {!newEventAllDay && (
                                            <>
                                                <AppTimeField
                                                    label="Start time"
                                                    value={newEventTimes.start}
                                                    onChange={value => {
                                                        setNewEventTimes(current => ({
                                                            start: value,
                                                            end: oneHourAfter(value) ?? current.end,
                                                        }));
                                                        setNewEventTimeError(false);
                                                    }}
                                                    onOpen={() => { newEventTimePickerOpenRef.current = true; }}
                                                    onClose={() => { newEventTimePickerOpenRef.current = false; }}
                                                    size="small"
                                                />
                                                <AppTimeField
                                                    label="End time"
                                                    value={newEventTimes.end}
                                                    onChange={value => {
                                                        setNewEventTimes(current => ({ ...current, end: value }));
                                                        setNewEventTimeError(false);
                                                    }}
                                                    onOpen={() => { newEventTimePickerOpenRef.current = true; }}
                                                    onClose={() => { newEventTimePickerOpenRef.current = false; }}
                                                    size="small"
                                                />
                                            </>
                                        )}
                                    </Stack>
                                </Box>
                            </Popover>
                        </Box>
                    )}
                    {todayEvents.map(item => (
                        <TodayEventCard
                            key={item.id}
                            item={item}
                            dayStart={dayStart}
                            pendingCreation={item.event.id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX)}
                            onEventUpdated={updateEventInState}
                            onEventDeleted={removeEventFromState}
                        />
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
}
