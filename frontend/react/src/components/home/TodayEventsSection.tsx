import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addDays, format } from 'date-fns';
import { alpha } from '@mui/material/styles';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    ClickAwayListener,
    Collapse,
    FormControlLabel,
    IconButton,
    Menu,
    MenuItem,
    Popover,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { AppTimeField } from '../input/AppPickerFields';
import { useKeyboardDelete } from '../../hooks/useKeyboardDelete';
import { eventService } from '../../services/api';
import { calendarService } from '../../services/api/calendarService';
import { homeTodayEventsSnapshot } from '../../services/cache/homeTodayEventsSnapshot';
import { getHomeTodayEventsExpanded, setHomeTodayEventsExpanded } from '../../services/utils/homePreferences';
import { saveEventTimePreferences } from '../../services/utils/inputPreferences';
import { CalendarEvent, CalendarEventInput, CalendarEventStatus } from '../../types/CalendarEvent';
import { Calendar } from '../../types/Calendar';
import { CalendarChipSelect } from '../calendar/CalendarSelect';

import {
    HOME_SECTION_AUTO_SCROLL_MS,
    NEW_EVENT_POPUP_CONTENT_SELECTOR,
    NEW_EVENT_POPUP_TRIGGER_SELECTOR,
    NEW_EVENT_STATUSES,
    OPTIMISTIC_EVENT_ID_PREFIX,
    applyDateAndTime,
    createOptimisticEvent,
    defaultEventTimes,
    eventCalendarColor,
    eventStatusLabel,
    eventsForToday,
    findVerticalScrollContainer,
    oneHourAfter,
    sourceEventsForToday,
    timeRangeLabel,
    type BulkDeleteRequest,
    type TodayEvent,
} from './todayEvents';
import { eventDraftReveal } from './todayEventMotion';
import { EventStatusIcon } from './EventStatusIcon';
import { TodayEventCard } from './TodayEventCard';

let todayEventsSectionHasMounted = false;

export function TodayEventsSection({ dayStart }: { dayStart: Date }) {
    const todayKey = format(dayStart, 'yyyy-MM-dd');
    const [animateInitialExpansion] = useState(() => !todayEventsSectionHasMounted);
    const [initialEvents] = useState(() => {
        const snapshot = homeTodayEventsSnapshot.get(todayKey);
        if (snapshot !== undefined) return snapshot;

        const lastKnownEvents = eventService.getLastKnownEvents();
        return lastKnownEvents ? sourceEventsForToday(lastKnownEvents, dayStart) : undefined;
    });
    const [initialCalendars] = useState(() => calendarService.getCachedCalendars());
    const [events, setEvents] = useState<CalendarEvent[]>(() => initialEvents ?? []);
    const [calendars, setCalendars] = useState<Calendar[]>(() => initialCalendars ?? []);
    const [calendarsLoaded, setCalendarsLoaded] = useState(() => initialCalendars !== undefined);
    const [loading, setLoading] = useState(() => initialEvents === undefined);
    const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
    const [bulkDeleteRequest, setBulkDeleteRequest] = useState<BulkDeleteRequest | null>(null);
    const [bulkDeleteError, setBulkDeleteError] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [expanded, setExpanded] = useState(getHomeTodayEventsExpanded);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventError, setNewEventError] = useState(false);
    const [creatingEventRequest, setCreatingEventRequest] = useState(false);
    const [newEventTimes, setNewEventTimes] = useState(defaultEventTimes);
    const [newEventAllDay, setNewEventAllDay] = useState(false);
    const [newEventStatus, setNewEventStatus] = useState<CalendarEventStatus>('CONFIRMED');
    const [newEventCalendarId, setNewEventCalendarId] = useState('');
    const [newEventTimeAnchorEl, setNewEventTimeAnchorEl] = useState<HTMLElement | null>(null);
    const [newEventStatusAnchorEl, setNewEventStatusAnchorEl] = useState<HTMLElement | null>(null);
    const [newEventTimeError, setNewEventTimeError] = useState(false);
    const sectionRef = useRef<HTMLElement | null>(null);
    const newEventDraftRef = useRef<HTMLDivElement | null>(null);
    const newEventPopupPointerEventsRef = useRef(new WeakSet<Event>());
    const newEventPopupInteractionUntilRef = useRef(0);
    const finishNewEventDraftRef = useRef<() => void>(() => {});
    const eventRowRefs = useRef(new Map<string, HTMLDivElement>());
    const selectionAnchorRef = useRef<string | null>(null);
    const bulkDeleteInFlightRef = useRef(false);
    const previousEventPositionsRef = useRef(new Map<string, DOMRect>());
    const eventRenderIdAliasesRef = useRef(new Map<string, string>());
    const newEventAnimationOriginRef = useRef<{ key: string; left: number; top: number } | null>(null);
    const scrollToExpandedSectionRef = useRef(false);
    const scrollAnimationFrameRef = useRef<number | null>(null);
    const newEventTimePickerOpenRef = useRef(false);
    const createEventInFlightRef = useRef(false);
    const cancelCreateEventRef = useRef(false);

    useEffect(() => {
        todayEventsSectionHasMounted = true;
    }, []);

    useEffect(() => {
        setHomeTodayEventsExpanded(expanded);
    }, [expanded]);

    useEffect(() => {
        if (loading) return;
        homeTodayEventsSnapshot.set(todayKey, sourceEventsForToday(events, dayStart));
    }, [dayStart, events, loading, todayKey]);

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

    useEffect(() => {
        let cancelled = false;
        calendarService.getCalendars()
            .then(result => {
                if (cancelled) return;
                setCalendars(result);
            })
            .catch(error => console.error('Could not load calendars for Home event creation:', error))
            .finally(() => { if (!cancelled) setCalendarsLoaded(true); });
        return () => { cancelled = true; };
    }, []);

    const todayEvents = useMemo(() => eventsForToday(events, dayStart), [dayStart, events]);
    const selectedEventIdSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds]);
    useEffect(() => {
        const visibleEventIds = new Set(todayEvents.map(item => item.id));
        setSelectedEventIds(current => current.filter(id => visibleEventIds.has(id)));
        if (selectionAnchorRef.current && !visibleEventIds.has(selectionAnchorRef.current)) {
            selectionAnchorRef.current = null;
        }
    }, [todayEvents]);
    const todayEventsRef = useRef(todayEvents);
    todayEventsRef.current = todayEvents;
    const getEventRenderKey = (item: TodayEvent) =>
        `${eventRenderIdAliasesRef.current.get(item.event.id) ?? item.event.id}:${item.occurrenceKey}`;
    const todayEventLayoutKey = todayEvents.map(getEventRenderKey).join('|');

    useLayoutEffect(() => {
        const nextPositions = new Map<string, DOMRect>();
        const previousPositions = previousEventPositionsRef.current;
        const origin = newEventAnimationOriginRef.current;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        todayEventsRef.current.forEach(item => {
            const key = getEventRenderKey(item);
            const element = eventRowRefs.current.get(key);
            if (!element) return;

            const nextPosition = element.getBoundingClientRect();
            nextPositions.set(key, nextPosition);
            const previousPosition = previousPositions.get(key)
                ?? (origin?.key === key ? origin : undefined);
            if (!previousPosition || reducedMotion) return;

            const deltaX = previousPosition.left - nextPosition.left;
            const deltaY = previousPosition.top - nextPosition.top;
            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

            element.animate(
                [
                    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
                    { transform: 'translate3d(0, 0, 0)' },
                ],
                { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            );
        });

        previousEventPositionsRef.current = nextPositions;
        newEventAnimationOriginRef.current = null;
    }, [todayEventLayoutKey]);

    const updateEventInState = (updatedEvent: CalendarEvent) => {
        setEvents(current => current.map(event => event.id === updatedEvent.id ? updatedEvent : event));
    };
    const removeEventFromState = (eventId: string) => {
        setEvents(current => current.filter(event => event.id !== eventId));
        setSelectedEventIds(current => current.filter(id => !id.startsWith(`${eventId}:`)));
        if (selectionAnchorRef.current?.startsWith(`${eventId}:`)) selectionAnchorRef.current = null;
    };

    const handleEventSelection = useCallback((itemId: string, event?: React.MouseEvent<HTMLElement>) => {
        const anchorId = selectionAnchorRef.current;
        if (event?.shiftKey && anchorId) {
            const anchorIndex = todayEvents.findIndex(item => item.id === anchorId);
            const itemIndex = todayEvents.findIndex(item => item.id === itemId);
            if (anchorIndex !== -1 && itemIndex !== -1) {
                const start = Math.min(anchorIndex, itemIndex);
                const end = Math.max(anchorIndex, itemIndex);
                const rangeIds = todayEvents.slice(start, end + 1)
                    .filter(item => !item.event.id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX))
                    .map(item => item.id);
                setSelectedEventIds(current => [...new Set([...current, ...rangeIds])]);
                return;
            }
        }

        if (event?.ctrlKey || event?.metaKey) {
            setSelectedEventIds(current => current.includes(itemId)
                ? current.filter(selectedId => selectedId !== itemId)
                : [...current, itemId]);
            selectionAnchorRef.current = itemId;
            return;
        }

        setSelectedEventIds([itemId]);
        selectionAnchorRef.current = itemId;
    }, [todayEvents]);

    const requestBulkDelete = (anchor: HTMLElement) => {
        const selectedItems = todayEvents.filter(item => selectedEventIdSet.has(item.id)
            && !item.event.id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX));
        if (selectedItems.length === 0 || bulkDeleteInFlightRef.current) return;
        const rect = anchor.getBoundingClientRect();
        setBulkDeleteError(false);
        setBulkDeleteRequest({
            items: selectedItems,
            anchorPosition: { top: rect.bottom, left: rect.right },
        });
    };

    const confirmBulkDelete = async () => {
        if (!bulkDeleteRequest || bulkDeleteInFlightRef.current) return;
        bulkDeleteInFlightRef.current = true;
        setBulkDeleting(true);
        setBulkDeleteError(false);
        const itemsByEventId = new Map<string, TodayEvent[]>();
        bulkDeleteRequest.items.forEach(item => {
            const items = itemsByEventId.get(item.event.id) ?? [];
            items.push(item);
            itemsByEventId.set(item.event.id, items);
        });
        const results = await Promise.all([...itemsByEventId].map(async ([eventId, items]) => {
            const completed: { item: TodayEvent; updated: CalendarEvent | null }[] = [];
            const failed: { item: TodayEvent; error: unknown }[] = [];
            for (const item of items) {
                try {
                    if (item.event.recurrenceFrequency !== 'NONE') {
                        const updated = await eventService.deleteEventOccurrence(eventId, item.occurrenceKey);
                        completed.push({ item, updated });
                    } else {
                        await eventService.deleteEvent(eventId);
                        completed.push({ item, updated: null });
                    }
                } catch (error) {
                    failed.push({ item, error });
                }
            }
            return { completed, failed };
        }));

        const completed = results.flatMap(result => result.completed);
        const failedItems = results.flatMap(result => result.failed.map(failure => failure.item));
        results.forEach(result => result.failed.forEach(failure => {
            console.error(`Failed to delete calendar event ${failure.item.event.id}:`, failure.error);
        }));

        if (completed.length > 0) {
            const deletedEventIds = new Set(completed.filter(result => result.updated === null)
                .map(result => result.item.event.id));
            const updatesById = new Map(completed.flatMap(result => result.updated
                ? [[result.updated.id, result.updated] as const]
                : []));
            setEvents(current => current
                .filter(event => !deletedEventIds.has(event.id))
                .map(event => updatesById.get(event.id) ?? event));
        }

        const failedIds = new Set(failedItems.map(item => item.id));
        setSelectedEventIds(failedItems.map(item => item.id));
        selectionAnchorRef.current = failedItems[failedItems.length - 1]?.id ?? null;
        if (failedItems.length > 0) {
            setBulkDeleteRequest(current => current
                ? { ...current, items: current.items.filter(item => failedIds.has(item.id)) }
                : null);
            setBulkDeleteError(true);
        } else {
            setBulkDeleteRequest(null);
        }
        bulkDeleteInFlightRef.current = false;
        setBulkDeleting(false);
    };

    useKeyboardDelete({
        enabled: selectedEventIds.length > 0 && !bulkDeleteRequest && !bulkDeleting,
        onDelete: () => {
            const lastSelectedItem = [...selectedEventIds].reverse()
                .map(id => todayEvents.find(item => item.id === id))
                .find((item): item is TodayEvent => Boolean(item));
            const anchor = lastSelectedItem
                ? eventRowRefs.current.get(getEventRenderKey(lastSelectedItem))
                : null;
            requestBulkDelete(anchor ?? sectionRef.current ?? document.body);
        },
    });

    const dismissNewEventDraft = useCallback(() => {
        if (createEventInFlightRef.current) return;
        newEventTimePickerOpenRef.current = false;
        setCreatingEvent(false);
        setNewEventTitle('');
        setNewEventError(false);
        setNewEventTimeError(false);
        setNewEventTimeAnchorEl(null);
        setNewEventStatusAnchorEl(null);
    }, []);

    const preserveNewEventDraftAfterPopupInteraction = useCallback(() => {
        newEventPopupInteractionUntilRef.current = Date.now() + 800;
    }, []);

    useEffect(() => {
        if (!creatingEvent) return;

        const dismissOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (target && newEventDraftRef.current?.contains(target)) return;
            if (newEventPopupPointerEventsRef.current.has(event)) return;
            if (target?.closest(NEW_EVENT_POPUP_CONTENT_SELECTOR)) {
                preserveNewEventDraftAfterPopupInteraction();
                return;
            }
            finishNewEventDraftRef.current();
        };

        document.addEventListener('pointerdown', dismissOnOutsidePointer, true);
        return () => document.removeEventListener('pointerdown', dismissOnOutsidePointer, true);
    }, [creatingEvent, dismissNewEventDraft, preserveNewEventDraftAfterPopupInteraction]);

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
            calendarId: newEventCalendarId || undefined,
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
        const optimisticOccurrence = eventsForToday([optimisticEvent], dayStart)[0];
        const currentPositions = new Map<string, DOMRect>();
        todayEventsRef.current.forEach(item => {
            const key = getEventRenderKey(item);
            const element = eventRowRefs.current.get(key);
            if (element) currentPositions.set(key, element.getBoundingClientRect());
        });
        previousEventPositionsRef.current = currentPositions;
        const draftPosition = newEventDraftRef.current?.getBoundingClientRect();
        newEventAnimationOriginRef.current = optimisticOccurrence && draftPosition
            ? {
                key: getEventRenderKey(optimisticOccurrence),
                left: draftPosition.left,
                top: draftPosition.top,
            }
            : null;

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
            eventRenderIdAliasesRef.current.set(createdEvent.id, optimisticEvent.id);
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

    finishNewEventDraftRef.current = () => {
        if (createEventInFlightRef.current) return;
        if (newEventTitle.trim()) {
            void createTodayEvent();
            return;
        }
        dismissNewEventDraft();
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
            aria-busy={loading || !calendarsLoaded || undefined}
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
                        setNewEventCalendarId('');
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
                appear={animateInitialExpansion}
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
                    {creatingEvent && (
                        <Box
                            component="div"
                            onPointerDownCapture={event => {
                                newEventPopupPointerEventsRef.current.add(event.nativeEvent);
                                const target = event.target instanceof Element ? event.target : null;
                                if (target?.closest(NEW_EVENT_POPUP_TRIGGER_SELECTOR)) {
                                    preserveNewEventDraftAfterPopupInteraction();
                                }
                            }}
                            onBlur={event => {
                                const nextTarget = event.relatedTarget;
                                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                                const wrapper = event.currentTarget;
                                window.setTimeout(() => {
                                    const activeElement = document.activeElement;
                                    if (activeElement instanceof Node && wrapper.contains(activeElement)) return;
                                    if (nextTarget instanceof Element
                                        && nextTarget.closest(NEW_EVENT_POPUP_CONTENT_SELECTOR)
                                        && Date.now() < newEventPopupInteractionUntilRef.current) return;
                                    if (activeElement instanceof Element
                                        && activeElement.closest(NEW_EVENT_POPUP_CONTENT_SELECTOR)) return;
                                    if (Date.now() < newEventPopupInteractionUntilRef.current) return;
                                    if (newEventTimeAnchorEl || newEventStatusAnchorEl || newEventTimePickerOpenRef.current) return;
                                    finishNewEventDraftRef.current();
                                }, 0);
                            }}
                            sx={{ display: 'contents' }}
                        >
                            {!creatingEventRequest && (
                                <Box
                                    ref={newEventDraftRef}
                                    sx={theme => {
                                        const calendarColor = eventCalendarColor(
                                            calendars,
                                            newEventCalendarId,
                                            theme.palette.primary.main,
                                        );
                                        const tentative = newEventStatus === 'TENTATIVE';
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
                                                : newEventStatus === 'CANCELLED' ? 'dotted' : 'solid',
                                            borderLeft: tentative ? `1.5px dashed ${calendarColor}` : `4px solid ${calendarColor}`,
                                            borderRadius: '0 12px 12px 0',
                                            backgroundColor: alpha(calendarColor, theme.palette.mode === 'dark' ? 0.06 : 0.025),
                                            animation: `${eventDraftReveal} 180ms ease-out`,
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
                                            sx={theme => {
                                                const color = eventCalendarColor(
                                                    calendars,
                                                    newEventCalendarId,
                                                    theme.palette.primary.main,
                                                );
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
                                            {newEventAllDay
                                                ? 'All day'
                                                : timeRangeLabel(newEventTimes.start, newEventTimes.end)}
                                        </ButtonBase>

                                        <Tooltip title={`${eventStatusLabel(newEventStatus)} · Change status`}>
                                            <Box component="span" sx={{ gridColumn: 2, gridRow: 2, justifySelf: 'end', display: 'inline-flex' }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={clickEvent => {
                                                        clickEvent.stopPropagation();
                                                        preserveNewEventDraftAfterPopupInteraction();
                                                        setNewEventStatusAnchorEl(clickEvent.currentTarget);
                                                    }}
                                                    aria-label={`Change new event status, currently ${eventStatusLabel(newEventStatus)}`}
                                                    sx={theme => {
                                                        const color = eventCalendarColor(
                                                            calendars,
                                                            newEventCalendarId,
                                                            theme.palette.primary.main,
                                                        );
                                                        return {
                                                            width: 30,
                                                            height: 30,
                                                            color,
                                                            borderRadius: 0,
                                                            '&:hover': { bgcolor: 'transparent' },
                                                        };
                                                    }}
                                                >
                                                    <EventStatusIcon status={newEventStatus} />
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
                                                value={newEventCalendarId}
                                                onChange={calendarId => {
                                                    preserveNewEventDraftAfterPopupInteraction();
                                                    setNewEventCalendarId(calendarId);
                                                }}
                                                onMenuOpenChange={preserveNewEventDraftAfterPopupInteraction}
                                            />
                                        </Box>
                                    </Box>

                                    <Menu
                                        anchorEl={newEventStatusAnchorEl}
                                        open={Boolean(newEventStatusAnchorEl)}
                                        onClose={() => {
                                            preserveNewEventDraftAfterPopupInteraction();
                                            setNewEventStatusAnchorEl(null);
                                        }}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                    >
                                        {NEW_EVENT_STATUSES.map(status => (
                                            <MenuItem
                                                key={status}
                                                selected={status === newEventStatus}
                                                sx={theme => {
                                                    const color = eventCalendarColor(
                                                        calendars,
                                                        newEventCalendarId,
                                                        theme.palette.primary.main,
                                                    );
                                                    return {
                                                        '&.Mui-selected': {
                                                            backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.08),
                                                        },
                                                        '&.Mui-selected:hover': {
                                                            backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.12),
                                                        },
                                                    };
                                                }}
                                                onClick={() => {
                                                    preserveNewEventDraftAfterPopupInteraction();
                                                    setNewEventStatus(status);
                                                    setNewEventStatusAnchorEl(null);
                                                }}
                                            >
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
                                                && target.closest('.MuiPickerPopper-root, .MuiPickersPopper-root, .MuiDialog-root')) return;
                                            newEventTimePickerOpenRef.current = false;
                                            preserveNewEventDraftAfterPopupInteraction();
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
                                                                preserveNewEventDraftAfterPopupInteraction();
                                                                setNewEventTimes(current => ({
                                                                    start: value,
                                                                    end: oneHourAfter(value) ?? current.end,
                                                                }));
                                                                setNewEventTimeError(false);
                                                            }}
                                                            onOpen={() => { newEventTimePickerOpenRef.current = true; }}
                                                            onClose={() => {
                                                                newEventTimePickerOpenRef.current = false;
                                                                preserveNewEventDraftAfterPopupInteraction();
                                                            }}
                                                            size="small"
                                                        />
                                                        <AppTimeField
                                                            label="End time"
                                                            value={newEventTimes.end}
                                                            onChange={value => {
                                                                preserveNewEventDraftAfterPopupInteraction();
                                                                setNewEventTimes(current => ({ ...current, end: value }));
                                                                setNewEventTimeError(false);
                                                            }}
                                                            onOpen={() => { newEventTimePickerOpenRef.current = true; }}
                                                            onClose={() => {
                                                                newEventTimePickerOpenRef.current = false;
                                                                preserveNewEventDraftAfterPopupInteraction();
                                                            }}
                                                            size="small"
                                                        />
                                                    </>
                                                )}
                                            </Stack>
                                        </Box>
                                    </Popover>
                                </Box>
                            )}
                        </Box>
                    )}
                    <ClickAwayListener onClickAway={event => {
                        if (event.target instanceof Element
                            && event.target.closest('.MuiPopover-root, .MuiMenu-root')) return;
                        if (event.target instanceof Node && sectionRef.current?.contains(event.target)) return;
                        setSelectedEventIds([]);
                        selectionAnchorRef.current = null;
                    }}>
                        <Box sx={{ display: 'contents' }}>
                            {todayEvents.map(item => (
                                <Box
                                    key={getEventRenderKey(item)}
                                    ref={element => {
                                        const key = getEventRenderKey(item);
                                        if (element) eventRowRefs.current.set(key, element as HTMLDivElement);
                                        else eventRowRefs.current.delete(key);
                                    }}
                                    sx={{ minWidth: 0 }}
                                >
                                    <TodayEventCard
                                        item={item}
                                        calendars={calendars}
                                        dayStart={dayStart}
                                        pendingCreation={item.event.id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX)}
                                        selected={selectedEventIdSet.has(item.id)}
                                        onSelect={handleEventSelection}
                                        onEventUpdated={updateEventInState}
                                        onEventDeleted={removeEventFromState}
                                    />
                                </Box>
                            ))}
                        </Box>
                    </ClickAwayListener>
                </Box>
            </Collapse>
            <Popover
                open={Boolean(bulkDeleteRequest)}
                onClose={() => !bulkDeleting && setBulkDeleteRequest(null)}
                anchorReference="anchorPosition"
                anchorPosition={bulkDeleteRequest?.anchorPosition}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 300,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                <Typography variant="body2" sx={{ mb: 1.25 }}>
                    Delete {bulkDeleteRequest?.items.length ?? 0} selected event{bulkDeleteRequest?.items.length === 1 ? '' : 's'}? Recurring events will be removed from today only.
                </Typography>
                {bulkDeleteError && <Alert severity="error" sx={{ mb: 1 }}>Couldn&apos;t delete some selected events.</Alert>}
                <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                    <Button size="small" onClick={() => setBulkDeleteRequest(null)} disabled={bulkDeleting}>
                        Keep events
                    </Button>
                    <Button
                        size="small"
                        color="error"
                        variant="contained"
                        onClick={() => void confirmBulkDelete()}
                        disabled={bulkDeleting || !bulkDeleteRequest?.items.length}
                    >
                        {bulkDeleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </Stack>
            </Popover>
        </Box>
    );
}
