import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { alpha } from '@mui/material/styles';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    FormControlLabel,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Popover,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { TaskReminderPicker } from '../task/TaskReminderPicker';
import { AppTimeField } from '../input/AppPickerFields';
import { eventService } from '../../services/api';
import { readEventTimePreferences, saveEventTimePreferences } from '../../services/utils/inputPreferences';
import {
    CalendarEvent,
    CalendarEventOccurrenceMoveInput,
    CalendarEventStatus,
} from '../../types/CalendarEvent';
import { Calendar } from '../../types/Calendar';
import { CalendarChipSelect } from '../calendar/CalendarSelect';

import {
    EVENT_STATUSES,
    applyDateAndTime,
    applyTime,
    eventCalendarColor,
    eventDate,
    eventInput,
    eventStatusLabel,
    eventTimeLabel,
    oneHourAfter,
    type DeleteRequest,
    type TodayEvent,
} from './todayEvents';
import { EventStatusIcon } from './EventStatusIcon';

export type TodayEventCardProps = {
    item: TodayEvent;
    calendars: Calendar[];
    dayStart: Date;
    pendingCreation: boolean;
    selected: boolean;
    onSelect: (itemId: string, event?: React.MouseEvent<HTMLElement>) => void;
    onEventUpdated: (event: CalendarEvent) => void;
    onEventDeleted: (eventId: string) => void;
};

export function TodayEventCard({
    item,
    calendars,
    dayStart,
    pendingCreation,
    selected,
    onSelect,
    onEventUpdated,
    onEventDeleted,
}: TodayEventCardProps) {
    const [editingName, setEditingName] = useState(false);
    const [localName, setLocalName] = useState(item.event.title ?? '');
    const [nameOverride, setNameOverride] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState(false);
    const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
    const [statusOverride, setStatusOverride] = useState<CalendarEventStatus | null>(null);
    const [calendarOverride, setCalendarOverride] = useState<string | null>(null);
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
    const calendarRequestIdRef = useRef(0);
    const calendarUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
    const reminderRequestIdRef = useRef(0);
    const displayStatus = statusOverride ?? item.status;
    const displayedItem = timeOverride ? { ...item, ...timeOverride } : item;
    const reminderValue = reminderOverride !== undefined
        ? reminderOverride
        : item.event.reminderMinutesBefore;
    const eventTitle = item.event.title || 'Untitled event';
    const displayedCalendarId = calendarOverride ?? item.event.calendarId;

    useEffect(() => {
        if (calendarOverride === item.event.calendarId) setCalendarOverride(null);
    }, [calendarOverride, item.event.calendarId]);

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

    const updateCalendar = (calendarId: string) => {
        if (item.event.sourceId || calendarId === displayedCalendarId) return;
        const requestId = calendarRequestIdRef.current + 1;
        calendarRequestIdRef.current = requestId;
        setCalendarOverride(calendarId);
        calendarUpdateQueueRef.current = calendarUpdateQueueRef.current
            .catch(() => {})
            .then(async () => {
                try {
                    const updated = await eventService.updateEvent(item.event.id, {
                        ...eventInput(item.event),
                        calendarId,
                    });
                    onEventUpdated(updated);
                    if (calendarRequestIdRef.current === requestId) {
                        setCalendarOverride(null);
                    }
                } catch (error) {
                    console.error('Failed to update calendar event calendar:', error);
                    if (calendarRequestIdRef.current === requestId) setCalendarOverride(null);
                }
            });
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
        if (deleteRequest.scope !== 'future') setOptimisticallyDeleted(true);
        try {
            if (deleteRequest.scope === 'occurrence') {
                const updated = await eventService.deleteEventOccurrence(item.event.id, item.occurrenceKey);
                onEventUpdated(updated);
            } else if (deleteRequest.scope === 'future') {
                const result = await eventService.deleteFutureEventOccurrences(item.event.id, item.occurrenceKey);
                if (result.eventDeleted) onEventDeleted(item.event.id);
                else if (result.event) onEventUpdated(result.event);
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

    if (item.event.sourceId) {
        return (
            <Box
                role="group"
                aria-label={`${eventTitle}, read-only imported event`}
                sx={theme => {
                    const tentative = displayStatus === 'TENTATIVE';
                    const calendarColor = eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main);
                    return {
                        minWidth: 0,
                        p: 1.25,
                        py: 1.5,
                        pl: 1.75,
                        border: '1px solid',
                        borderColor: alpha(calendarColor, 0.38),
                        borderWidth: tentative ? 1.5 : 1,
                        borderStyle: tentative
                            ? 'dashed'
                            : displayStatus === 'CANCELLED' ? 'dotted' : 'solid',
                        borderLeft: tentative ? `1.5px dashed ${calendarColor}` : `4px solid ${calendarColor}`,
                        borderRadius: '0 12px 12px 0',
                        backgroundColor: alpha(calendarColor, theme.palette.mode === 'dark' ? 0.06 : 0.025),
                    };
                }}
            >
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gridTemplateRows: 'auto auto',
                    alignItems: 'start',
                    columnGap: 1.25,
                    rowGap: 0.9,
                    minWidth: 0,
                }}>
                    <Box sx={{
                        gridColumn: 1,
                        gridRow: 1,
                        minWidth: 0,
                        textAlign: 'left',
                    }}>
                        <Typography
                            component="span"
                            sx={{
                                fontSize: '1.1rem',
                                lineHeight: 1.35,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                textAlign: 'left',
                                color: 'text.primary',
                                textDecoration: displayStatus === 'CANCELLED' ? 'line-through' : 'none',
                            }}
                        >
                            {eventTitle}
                        </Typography>
                    </Box>
                    <Box
                        sx={theme => {
                            const color = eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main);
                            return {
                                gridColumn: 1,
                                gridRow: 2,
                                justifySelf: 'start',
                                display: 'inline-flex',
                                alignItems: 'center',
                                maxWidth: '100%',
                                px: 0.85,
                                py: 0.35,
                                borderRadius: 1.2,
                                color,
                                backgroundColor: alpha(color, 0.03),
                                fontSize: '0.775rem',
                                fontWeight: 600,
                                textAlign: 'left',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'normal',
                                lineHeight: 1.25,
                            };
                        }}
                    >
                        <AccessTimeRoundedIcon sx={{ fontSize: 14, mr: 0.55, flexShrink: 0 }} />
                        {eventTimeLabel(displayedItem, dayStart)}
                    </Box>
                    <Box
                        component="span"
                        role="img"
                        aria-label={eventStatusLabel(displayStatus)}
                        sx={theme => ({
                            gridColumn: 2,
                            gridRow: 2,
                            justifySelf: 'end',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 30,
                            height: 30,
                            color: eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main),
                        })}
                    >
                        <EventStatusIcon status={displayStatus} />
                    </Box>
                    <Box sx={{
                        gridColumn: 2,
                        gridRow: 1,
                        justifySelf: 'end',
                        minWidth: 0,
                        maxWidth: '100%',
                        visibility: calendars.length > 0 ? 'visible' : 'hidden',
                    }}>
                        <CalendarChipSelect
                            calendars={calendars}
                            value={displayedCalendarId}
                            onChange={() => {}}
                            readOnly
                        />
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            role="group"
            tabIndex={pendingCreation ? -1 : 0}
            aria-label={`${selected ? 'Selected event' : 'Select event'}: ${eventTitle}. Press Enter or Space to select${selected ? ', or Delete to remove selected events' : ''}.`}
            aria-keyshortcuts={selected ? 'Enter Space Delete' : 'Enter Space'}
            onClick={clickEvent => {
                if (!pendingCreation) onSelect(item.id, clickEvent);
            }}
            onKeyDown={keyEvent => {
                if (keyEvent.target !== keyEvent.currentTarget || pendingCreation) return;
                if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                    keyEvent.preventDefault();
                    onSelect(item.id);
                }
            }}
            onContextMenu={contextEvent => {
                contextEvent.preventDefault();
                if (pendingCreation) return;
                setContextMenuPosition({ top: contextEvent.clientY, left: contextEvent.clientX });
            }}
            aria-busy={pendingCreation || undefined}
            sx={theme => {
                const selectedColor = theme.palette.primary.main;
                const tentative = displayStatus === 'TENTATIVE';
                const calendarColor = eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main);
                return {
                    minWidth: 0,
                    p: 1.25,
                    py: 1.5,
                    pl: 1.75,
                    border: '1px solid',
                    borderColor: selected ? alpha(calendarColor, 0.5) : alpha(calendarColor, 0.32),
                    borderWidth: tentative ? 1.5 : 1,
                    borderStyle: tentative
                        ? 'dashed'
                        : displayStatus === 'CANCELLED' ? 'dotted' : 'solid',
                    borderLeft: tentative ? `1.5px dashed ${calendarColor}` : `4px solid ${calendarColor}`,
                    borderRadius: '0 12px 12px 0',
                    backgroundColor: selected
                        ? alpha(calendarColor, theme.palette.mode === 'dark' ? 0.14 : 0.09)
                        : alpha(calendarColor, theme.palette.mode === 'dark' ? 0.04 : 0.02),
                    cursor: pendingCreation ? 'default' : 'pointer',
                    boxShadow: selected ? `0 1px 5px ${alpha(calendarColor, 0.1)}` : 'none',
                    transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
                    '&:hover': pendingCreation ? undefined : {
                        boxShadow: `0 2px 7px ${alpha(calendarColor, 0.12)}`,
                    },
                    '&:focus-visible': {
                        outline: `2px solid ${selectedColor}`,
                        outlineOffset: 2,
                    },
                };
            }}
        >
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gridTemplateRows: 'auto auto',
                alignItems: 'start',
                columnGap: 1.25,
                rowGap: 0.9,
                minWidth: 0,
            }}>
                <Box sx={{
                    gridColumn: 1,
                    gridRow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    minWidth: 0,
                    textAlign: 'left',
                }}>
                    <Box
                        component="span"
                        data-event-name="true"
                        onClick={clickEvent => {
                            if (pendingCreation) return;
                            clickEvent.stopPropagation();
                            onSelect(item.id, clickEvent);
                            setNameError(false);
                            setEditingName(true);
                        }}
                        sx={{
                            display: 'inline-block',
                            position: 'relative',
                            width: 'max-content',
                            maxWidth: 'calc(100% - 14px)',
                            boxSizing: 'border-box',
                            textAlign: 'left',
                            cursor: 'text',
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                right: -14,
                                width: 14,
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
                                {editingName ? localName : (nameOverride ?? eventTitle)}
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
                                    '& .MuiInputBase-root': {
                                        height: '100%',
                                        minHeight: '1.35em',
                                        padding: 0,
                                        alignItems: 'flex-start',
                                    },
                                    '& .MuiInputBase-input': {
                                        color: theme.palette.text.primary,
                                        WebkitTextFillColor: theme.palette.text.primary,
                                        fontSize: '1.1rem',
                                        fontFamily: theme.typography.fontFamily,
                                        fontWeight: theme.typography.fontWeightRegular,
                                        lineHeight: 1.35,
                                        whiteSpace: 'pre-wrap',
                                        overflowWrap: 'anywhere',
                                        textAlign: 'left',
                                        padding: 0,
                                        margin: 0,
                                        boxSizing: 'border-box',
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
                    sx={theme => {
                        const color = eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main);
                        return {
                            gridColumn: 1,
                            gridRow: 2,
                            justifySelf: 'start',
                            flexShrink: 0,
                            maxWidth: '100%',
                            px: 0.85,
                            py: 0.35,
                            borderRadius: 1.2,
                            color,
                            backgroundColor: alpha(color, selected ? 0.07 : 0.03),
                            fontSize: '0.775rem',
                            fontWeight: 600,
                            textAlign: 'left',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'normal',
                            lineHeight: 1.25,
                            cursor: 'pointer',
                        };
                    }}
                >
                    <AccessTimeRoundedIcon sx={{ fontSize: 14, mr: 0.55, flexShrink: 0 }} />
                    {eventTimeLabel(displayedItem, dayStart)}
                </ButtonBase>

                <Tooltip title={`${eventStatusLabel(displayStatus)} · Change status`}>
                    <Box component="span" sx={{ gridColumn: 2, gridRow: 2, justifySelf: 'end', display: 'inline-flex' }}>
                        <IconButton
                            size="small"
                            disabled={pendingCreation}
                            onClick={clickEvent => {
                                clickEvent.stopPropagation();
                                setStatusAnchorEl(clickEvent.currentTarget);
                            }}
                            aria-label={`Change event status, currently ${eventStatusLabel(displayStatus)}`}
                            sx={theme => {
                                const color = eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main);
                                return {
                                    width: 30,
                                    height: 30,
                                    color,
                                    borderRadius: 0,
                                    '&:hover': { bgcolor: 'transparent' },
                                };
                            }}
                        >
                            <EventStatusIcon status={displayStatus} />
                        </IconButton>
                    </Box>
                </Tooltip>

                <Box sx={{
                    gridColumn: 2,
                    gridRow: 1,
                    justifySelf: 'end',
                    minWidth: 0,
                    maxWidth: '100%',
                    visibility: calendars.length > 0 ? 'visible' : 'hidden',
                }}>
                    <CalendarChipSelect
                        calendars={calendars}
                        value={displayedCalendarId}
                        onChange={updateCalendar}
                    />
                </Box>
            </Box>

            <Menu
                anchorEl={statusAnchorEl}
                open={Boolean(statusAnchorEl)}
                onClose={() => setStatusAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                {EVENT_STATUSES.map(status => (
                    <MenuItem
                        key={status}
                        selected={status === displayStatus}
                        sx={theme => {
                            const color = eventCalendarColor(calendars, displayedCalendarId, theme.palette.primary.main);
                            return {
                                '&.Mui-selected': {
                                    backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.08),
                                },
                                '&.Mui-selected:hover': {
                                    backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.12),
                                },
                            };
                        }}
                        onClick={() => void updateStatus(status)}
                    >
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
                {item.event.recurrenceFrequency !== 'NONE' && (
                    <MenuItem
                        onClick={clickEvent => requestDelete('future', clickEvent.currentTarget)}
                        sx={{
                            '&:hover': {
                                color: 'error.main',
                                '& .MuiListItemIcon-root': { color: 'inherit' },
                            },
                        }}
                    >
                        <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                        Delete future occurrences
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
                    if (target instanceof Element && target.closest('.MuiPickerPopper-root, .MuiPickersPopper-root, .MuiDialog-root')) return;
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
                        : deleteRequest?.scope === 'future'
                            ? 'Delete all occurrences after this one from your calendar? This occurrence will remain.'
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
