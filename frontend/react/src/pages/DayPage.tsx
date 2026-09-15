import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, Divider, IconButton, Skeleton, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import { addDays, format, isValid, parseISO, subDays } from 'date-fns';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/PageWrapper';
import { dayService } from '../services/api';
import { formatTimeValue } from '../services/utils/statValues';
import { expandCalendarEvent } from '../components/calendar/recurrence';
import { DayOverview, DayStat, DayTask } from '../types/DayOverview';

type TimelineKind = 'task' | 'focus' | 'meditation' | 'state' | 'note' | 'event';
type DetailTab = 'stats' | 'tasks' | 'notes' | 'more';
type DayViewMode = 'past' | 'today' | 'future';

type TimelineItem = {
    id: string;
    kind: TimelineKind;
    title: string;
    titleSuffix?: string;
    start: Date;
    end: Date | null;
    detail?: string;
    durationSeconds?: number;
    completed?: boolean;
};

const DAY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDayDuration(minutes: number | null | undefined): string {
    if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';

    const roundedMinutes = Math.round(minutes);
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h${remainingMinutes}m`;
}

function durationLabel(seconds: number): string {
    return formatDayDuration(seconds / 60);
}

function statValueLabel(stat: DayStat): string {
    if (stat.status === 'NOT_PLANNED') return 'Not planned';
    if (stat.type === 'BOOLEAN') return stat.value === 1 ? 'Yes' : 'No';
    if (stat.type === 'TIME') return formatTimeValue(stat.value);
    if (stat.type === 'DURATION') return formatDayDuration(stat.value);
    return Number.isInteger(stat.value) ? String(stat.value) : stat.value.toFixed(1);
}

function notePlainText(content: string): string {
    const container = document.createElement('div');
    container.innerHTML = content;
    return container.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function isWithinWindow(value: string | null | undefined, start: Date, end: Date): boolean {
    if (!value) return false;
    const parsed = parseISO(value);
    return isValid(parsed) && parsed >= start && parsed < end;
}

function dayViewMode(date: string): DayViewMode {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date < today) return 'past';
    if (date > today) return 'future';
    return 'today';
}

function isOnCalendarDate(value: string | null | undefined, date: string): boolean {
    if (!value) return false;
    const parsed = parseISO(value);
    return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === date;
}

function taskCompletionTime(task: DayTask, date: string): Date | null {
    if (!task.completed || !isOnCalendarDate(task.completedAt, date)) return null;

    const completionTime = parseISO(task.completedAt!);
    return isValid(completionTime) ? completionTime : null;
}

function buildTimeline(overview: DayOverview, mode: DayViewMode): TimelineItem[] {
    const dayStart = parseISO(overview.dayStart);
    const dayEnd = parseISO(overview.dayEnd);
    const calendarDayStart = parseISO(`${overview.date}T00:00:00`);
    const calendarDayEnd = addDays(calendarDayStart, 1);
    const items: TimelineItem[] = overview.tasks.flatMap(task => {
        const completionTime = taskCompletionTime(task, overview.date);
        if (!completionTime) return [];

        return [{
            id: `task-${task.id}`,
            kind: 'task' as const,
            title: task.name || 'Untitled task',
            start: completionTime,
            end: null,
            completed: true,
        }];
    });

    overview.focusSessions.forEach(session => {
        const start = parseISO(session.startTime);
        items.push({
            id: `focus-${session.id}`,
            kind: 'focus',
            title: session.taskName || 'Focus session',
            start,
            end: session.endTime ? parseISO(session.endTime) : null,
            detail: session.pomodoro ? 'Pomodoro focus' : 'Focus session',
            durationSeconds: session.durationSeconds,
        });
    });

    overview.meditationSessions.forEach(session => {
        const start = parseISO(session.startTime);
        items.push({
            id: `meditation-${session.id}`,
            kind: 'meditation',
            title: 'Meditation',
            start,
            end: session.endTime ? parseISO(session.endTime) : null,
            detail: 'Mindful pause',
            durationSeconds: session.durationSeconds,
        });
    });

    overview.mentalStateCheckIns.forEach(checkIn => {
        const start = parseISO(checkIn.recordedAt);
        items.push({
            id: `state-${checkIn.id}`,
            kind: 'state',
            title: 'Mental state check-in',
            start,
            end: null,
            detail: checkIn.state,
        });
    });

    overview.notes.forEach(note => {
        const timestamp = isWithinWindow(note.updatedAt, dayStart, dayEnd) ? note.updatedAt : note.createdAt;
        items.push({
            id: `note-${note.id}`,
            kind: 'note',
            title: note.title || 'Untitled note',
            start: parseISO(timestamp),
            end: null,
            detail: 'Note updated',
        });
    });

    overview.events.forEach(event => {
        const occurrences = expandCalendarEvent(
            event,
            mode === 'future' ? calendarDayStart : dayStart,
            mode === 'future' ? calendarDayEnd : dayEnd,
        );
        occurrences
            .filter(occurrence => {
                if (occurrence.allDay) {
                    const start = parseISO(`${occurrence.start}T00:00:00`);
                    const end = parseISO(`${occurrence.end}T00:00:00`);
                    return start < dayEnd && end > dayStart
                        && start < calendarDayEnd && end > calendarDayStart;
                }
                const start = parseISO(occurrence.start);
                const end = parseISO(occurrence.end);
                return start < dayEnd && end > dayStart
                    && start < calendarDayEnd && end > calendarDayStart;
            })
            .forEach(occurrence => {
                const rawStart = occurrence.allDay ? dayStart : parseISO(occurrence.start);
                const start = rawStart < dayStart ? dayStart : rawStart;
                if (occurrence.allDay || occurrence.status === 'CANCELLED') {
                    items.push({
                        id: `event-${occurrence.id}`,
                        kind: 'event',
                        title: event.title,
                        titleSuffix: occurrence.status === 'CANCELLED' ? 'canceled' : undefined,
                        start,
                        end: null,
                        detail: undefined,
                    });
                    return;
                }

                const end = parseISO(occurrence.end);
                items.push(
                    {
                        id: `event-${occurrence.id}-start`,
                        kind: 'event',
                        title: event.title,
                        titleSuffix: 'started',
                        start,
                        end: null,
                        detail: undefined,
                    },
                    {
                        id: `event-${occurrence.id}-end`,
                        kind: 'event',
                        title: event.title,
                        titleSuffix: 'finished',
                        start: end,
                        end: null,
                        detail: undefined,
                    },
                );
            });
    });

    return items
        .filter(item => (mode === 'past' && item.kind === 'task')
            || (isValid(item.start) && item.start >= dayStart && item.start < dayEnd))
        .sort((first, second) => {
            return first.start.getTime() - second.start.getTime();
        });
}

function TimelineIcon({ kind }: { kind: TimelineKind }) {
    const iconProps = { fontSize: 'small' as const };
    if (kind === 'task') return <TaskAltRoundedIcon {...iconProps} />;
    if (kind === 'focus') return <TimerOutlinedIcon {...iconProps} />;
    if (kind === 'meditation') return <SelfImprovementOutlinedIcon {...iconProps} />;
    if (kind === 'state') return <PsychologyOutlinedIcon {...iconProps} />;
    if (kind === 'note') return <EventNoteOutlinedIcon {...iconProps} />;
    return <EventNoteOutlinedIcon {...iconProps} />;
}

function timelineTimeLabel(item: TimelineItem): string {
    return format(item.start, 'h:mm a');
}

function TimeBoundary({ label, time, detail }: { label: string; time: Date; detail?: string }) {
    return (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative', py: 1 }}>
            <Box sx={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'background.paper', border: 2, borderColor: 'primary.main' }} />
            </Box>
            <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" color="primary.main" fontWeight={700}>{label}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="baseline">
                    <Typography variant="body2" fontWeight={650}>{format(time, 'h:mm a')}</Typography>
                    {detail && <Typography variant="caption" color="text.secondary">· {detail}</Typography>}
                </Stack>
            </Box>
        </Stack>
    );
}

function DayLoadingState() {
    return (
        <Stack spacing={2}>
            <Skeleton variant="rounded" height={100} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                {[0, 1, 2, 3].map(item => <Skeleton key={item} variant="rounded" height={82} sx={{ flex: 1 }} />)}
            </Stack>
            <Skeleton variant="rounded" height={320} />
        </Stack>
    );
}

export function DayPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { date: routeDate } = useParams<{ date: string }>();
    const date = routeDate && DAY_DATE_PATTERN.test(routeDate) && isValid(parseISO(`${routeDate}T12:00:00`))
        ? routeDate
        : format(new Date(), 'yyyy-MM-dd');
    const [overview, setOverview] = useState<DayOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>('stats');

    useEffect(() => {
        if (routeDate !== date) {
            navigate(`/day/${date}`, { replace: true });
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);
        dayService.getOverview(date, controller.signal)
            .then(setOverview)
            .catch(requestError => {
                if (requestError?.name !== 'AbortError') {
                    console.error('Failed to load day overview:', requestError);
                    setError('Could not load this day.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [date, navigate, routeDate]);

    const viewMode = dayViewMode(date);
    const timeline = useMemo(() => overview ? buildTimeline(overview, viewMode) : [], [overview, viewMode]);
    const completedTasks = overview?.tasks.filter(task => task.completed).length ?? 0;
    const pomodoroSeconds = overview?.focusSessions
        .filter(session => session.pomodoro)
        .reduce((total, session) => total + session.durationSeconds, 0) ?? 0;
    const meditationSeconds = overview?.meditationSessions
        .reduce((total, session) => total + session.durationSeconds, 0) ?? 0;
    const dateValue = parseISO(`${date}T12:00:00`);
    const windowStart = overview ? parseISO(overview.dayStart) : dateValue;
    const windowEnd = overview ? parseISO(overview.dayEnd) : addDays(dateValue, 1);
    const hasLoggedWakeUp = viewMode !== 'future'
        && (overview?.stats.some(stat => stat.systemKey === 'wake_up_time') ?? false);
    const hasLoggedSleep = viewMode !== 'future'
        && (overview?.stats.some(stat => stat.systemKey === 'sleep_time') ?? false);
    const sleepDuration = overview?.stats.find(stat =>
        stat.systemKey === 'sleep_hours' && stat.status !== 'NOT_PLANNED'
    );
    const sleepDurationLabel = sleepDuration ? formatDayDuration(sleepDuration.value) : undefined;
    const timeViewLabel = hasLoggedWakeUp
        ? `${format(windowStart, 'h:mm a')}${hasLoggedSleep ? ` – ${format(windowEnd, 'h:mm a')}` : ''}`
        : hasLoggedSleep ? `Sleep · ${format(windowEnd, 'h:mm a')}` : null;
    const moreTimeline = timeline.filter(item => item.kind === 'state' || item.kind === 'event');
    const hasDetailPanel = Boolean(overview && (
        overview.stats.length > 0
        || overview.tasks.length > 0
        || overview.notes.length > 0
        || moreTimeline.length > 0
    ));

    const moveDay = (amount: number) => {
        navigate(
            `/day/${format(amount < 0 ? subDays(dateValue, Math.abs(amount)) : addDays(dateValue, amount), 'yyyy-MM-dd')}`,
            { state: location.state },
        );
    };

    const leaveDayPage = () => {
        const returnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
        navigate(typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/calendar');
    };

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', minWidth: 0 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton aria-label="Back" onClick={leaveDayPage}>
                            <ArrowBackRoundedIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h5" fontWeight={700}>{format(dateValue, 'EEEE, MMMM d')}</Typography>
                            <Typography variant="body2" color="text.secondary">A time-ordered view of your day</Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <IconButton aria-label="Previous day" onClick={() => moveDay(-1)}><ChevronLeftRoundedIcon /></IconButton>
                        <Button size="small" variant="outlined" onClick={() => navigate(`/day/${format(new Date(), 'yyyy-MM-dd')}`)}>Today</Button>
                        <IconButton aria-label="Next day" onClick={() => moveDay(1)}><ChevronRightRoundedIcon /></IconButton>
                    </Stack>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {loading && !overview && <DayLoadingState />}
                {overview && (
                    <Stack spacing={2}>
                        <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="overline" color="text.secondary">Day notes</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {overview.day.summary || 'No summary written for this day.'}
                                    </Typography>
                                    {overview.day.plan && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                                            Plan: {overview.day.plan}
                                        </Typography>
                                    )}
                                </Box>
                                {overview.day.rating !== null && (
                                    <Box sx={{ minWidth: 120 }}>
                                        <Typography variant="overline" color="text.secondary">Day rating</Typography>
                                        <Typography variant="h4" fontWeight={700}>{overview.day.rating}<Typography component="span" variant="body2" color="text.secondary"> / 10</Typography></Typography>
                                    </Box>
                                )}
                            </Stack>
                        </Card>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
                            <SummaryCard icon={<TaskAltRoundedIcon />} value={`${completedTasks}/${overview.tasks.length}`} label="tasks completed" />
                            <SummaryCard icon={<TimerOutlinedIcon />} value={durationLabel(pomodoroSeconds)} label="Pomodoro focus" />
                            <SummaryCard icon={<SelfImprovementOutlinedIcon />} value={durationLabel(meditationSeconds)} label="meditation" />
                            <SummaryCard icon={<InsightsOutlinedIcon />} value={String(overview.stats.length)} label="stats recorded" />
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: hasDetailPanel ? 'minmax(0, 1.4fr) minmax(280px, 0.8fr)' : '1fr' }, gap: 2 }}>
                            <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                    <TimelineRoundedIcon color="primary" />
                                    <Box>
                                        <Typography variant="h6" fontWeight={700}>Time view</Typography>
                                        {timeViewLabel && <Typography variant="caption" color="text.secondary">{timeViewLabel}</Typography>}
                                    </Box>
                                </Stack>
                                <Stack spacing={0} sx={{ position: 'relative', '&:before': { content: '""', position: 'absolute', left: 16, top: 14, bottom: 14, width: 2, bgcolor: 'divider' } }}>
                                    {hasLoggedWakeUp && <TimeBoundary label="Wake up" time={windowStart} detail={sleepDurationLabel ? `Slept ${sleepDurationLabel}` : undefined} />}
                                    {timeline.length === 0 ? (
                                        <Typography color="text.secondary" sx={{ py: 4, pl: 5 }}>
                                            {viewMode === 'future'
                                                ? 'No completed tasks or other activity recorded for this day yet.'
                                                : 'Nothing recorded during this window yet.'}
                                        </Typography>
                                    ) : timeline.map(item => (
                                        <Stack key={item.id} direction="row" spacing={1.5} sx={{ position: 'relative', py: 1 }}>
                                            <Box sx={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
                                                <Box sx={{ bgcolor: 'background.paper', color: item.kind === 'task' && item.completed ? 'success.main' : 'primary.main', display: 'flex', borderRadius: '50%', p: 0.5 }}>
                                                    <TimelineIcon kind={item.kind} />
                                                </Box>
                                            </Box>
                                            <Box sx={{ minWidth: 0, flex: 1, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5}>
                                                    <Typography variant="body2" fontWeight={item.kind === 'event' ? 400 : 650} sx={{ textDecoration: item.kind === 'task' && item.completed ? 'line-through' : 'none' }}>
                                                        {item.kind === 'event' ? (
                                                            <>
                                                                <Box component="span" fontWeight={700}>{item.title}</Box>
                                                                {item.titleSuffix && ` ${item.titleSuffix}`}
                                                            </>
                                                        ) : item.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{timelineTimeLabel(item)}</Typography>
                                                </Stack>
                                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                                    {item.detail && <Typography variant="caption" color="text.secondary">{item.detail}</Typography>}
                                                    {item.durationSeconds !== undefined && <Chip size="small" variant="outlined" label={durationLabel(item.durationSeconds)} sx={{ height: 21 }} />}
                                                    {item.end && item.kind === 'event' && <Typography variant="caption" color="text.secondary">until {format(item.end, 'h:mm a')}</Typography>}
                                                </Stack>
                                            </Box>
                                        </Stack>
                                    ))}
                                    {hasLoggedSleep && <TimeBoundary label="Sleep" time={windowEnd} />}
                                </Stack>
                            </Card>

                            {hasDetailPanel && <DayDetailsPanel overview={overview} moreTimeline={moreTimeline} tab={detailTab} onTabChange={setDetailTab} viewMode={viewMode} />}
                        </Box>
                    </Stack>
                )}
            </Box>
        </PageWrapper>
    );
}

function DayDetailsPanel({
    overview,
    moreTimeline,
    tab,
    onTabChange,
    viewMode,
}: {
    overview: DayOverview;
    moreTimeline: TimelineItem[];
    tab: DetailTab;
    onTabChange: (tab: DetailTab) => void;
    viewMode: DayViewMode;
}) {
    const availableTabs: { value: DetailTab; label: string }[] = [];
    if (overview.stats.length > 0) availableTabs.push({ value: 'stats', label: `Stats (${overview.stats.length})` });
    if (overview.tasks.length > 0) availableTabs.push({ value: 'tasks', label: `Tasks (${overview.tasks.length})` });
    if (overview.notes.length > 0) availableTabs.push({ value: 'notes', label: `Notes (${overview.notes.length})` });
    if (moreTimeline.length > 0) availableTabs.push({ value: 'more', label: 'More' });

    const activeTab = availableTabs.some(option => option.value === tab)
        ? tab
        : availableTabs[0]?.value;

    useEffect(() => {
        if (activeTab && activeTab !== tab) onTabChange(activeTab);
    }, [activeTab, onTabChange, tab]);

    if (!activeTab) return null;

    const stateItems = moreTimeline.filter(item => item.kind === 'state');
    const eventItems = moreTimeline.filter(item => item.kind === 'event');

    return (
        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
            <Tabs
                value={activeTab}
                onChange={(_, value: DetailTab) => onTabChange(value)}
                variant="scrollable"
                allowScrollButtonsMobile
                sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
                {availableTabs.map(option => <Tab key={option.value} value={option.value} label={option.label} />)}
            </Tabs>
            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                {activeTab === 'stats' && (
                    <DetailSection title="Statistics" icon={<InsightsOutlinedIcon color="primary" />}>
                        {overview.stats.length === 0 ? <EmptySection text="No stats recorded." /> : (
                            <Stack divider={<Divider flexItem />}>
                                {overview.stats.map(stat => (
                                    <Stack key={stat.id} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 1 }}>
                                        <Typography variant="body2" noWrap>{stat.name}</Typography>
                                        <Typography variant="body2" fontWeight={700}>{statValueLabel(stat)}</Typography>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </DetailSection>
                )}
                {activeTab === 'tasks' && (
                    <DetailSection title="Tasks" icon={<CheckCircleOutlineRoundedIcon color="primary" />}>
                        {overview.tasks.length === 0 ? <EmptySection text="No tasks connected to this day." /> : (
                            <Stack divider={<Divider flexItem />}>
                                {overview.tasks.map(task => <TaskSummaryRow key={task.id} task={task} viewMode={viewMode} />)}
                            </Stack>
                        )}
                    </DetailSection>
                )}
                {activeTab === 'notes' && (
                    <DetailSection title="Notes touched" icon={<EventNoteOutlinedIcon color="primary" />}>
                        {overview.notes.length === 0 ? <EmptySection text="No notes touched during this window." /> : (
                            <Stack divider={<Divider flexItem />}>
                                {overview.notes.map(note => (
                                    <Box key={note.id} sx={{ py: 1 }}>
                                        <Typography variant="body2" fontWeight={650}>{note.title || 'Untitled note'}</Typography>
                                        {note.content && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>{notePlainText(note.content)}</Typography>}
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </DetailSection>
                )}
                {activeTab === 'more' && (
                    <Stack spacing={2}>
                        {stateItems.length > 0 && <DetailSection title="Mental state" icon={<PsychologyOutlinedIcon color="primary" />}>
                            <Stack divider={<Divider flexItem />}>
                                {stateItems.map(item => (
                                    <Stack key={item.id} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 1 }}>
                                        <Typography variant="body2">{item.detail}</Typography>
                                        <Typography variant="caption" color="text.secondary">{format(item.start, 'h:mm a')}</Typography>
                                    </Stack>
                                ))}
                            </Stack>
                        </DetailSection>}
                        {eventItems.length > 0 && <DetailSection title="Calendar events" icon={<EventNoteOutlinedIcon color="primary" />}>
                            {
                                <Stack divider={<Divider flexItem />}>
                                    {eventItems.map(item => (
                                        <Stack key={item.id} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 1 }}>
                                            <Box>
                                                <Typography variant="body2">
                                                    <Box component="span" fontWeight={700}>{item.title}</Box>
                                                    {item.titleSuffix && ` ${item.titleSuffix}`}
                                                </Typography>
                                                {item.detail && <Typography variant="caption" color="text.secondary">{item.detail}</Typography>}
                                            </Box>
                                            <Typography variant="caption" color="text.secondary">{format(item.start, 'h:mm a')}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            }
                        </DetailSection>}
                    </Stack>
                )}
            </Box>
        </Card>
    );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <Box sx={{ textAlign: 'left' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                {icon}
                <Typography variant="h6" fontWeight={700}>{title}</Typography>
            </Stack>
            {children}
        </Box>
    );
}

function SummaryCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
    return (
        <Card variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" fontWeight={750} noWrap>{value}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
                </Box>
            </Stack>
        </Card>
    );
}

function EmptySection({ text }: { text: string }) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{text}</Typography>;
}

function TaskSummaryRow({ task, viewMode }: { task: DayTask; viewMode: DayViewMode }) {
    const completionTime = task.completedAt && isValid(parseISO(task.completedAt))
        ? format(parseISO(task.completedAt), 'h:mm a')
        : null;
    const scheduledTime = task.scheduledAt && isValid(parseISO(task.scheduledAt))
        ? format(parseISO(task.scheduledAt), 'h:mm a')
        : null;
    const notCompleted = viewMode === 'past' && !task.completed;
    const timeLabel = viewMode === 'future' ? scheduledTime : completionTime;

    return (
        <Stack direction="row" alignItems="center" justifyContent="flex-start" spacing={1} sx={{ py: 1, textAlign: 'left' }}>
            <Box sx={{ color: notCompleted ? 'error.main' : task.completed ? 'success.main' : 'text.disabled', display: 'flex' }}>
                <CheckCircleOutlineRoundedIcon fontSize="small" />
            </Box>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0, textDecoration: task.completed ? 'line-through' : 'none' }} noWrap>
                {task.name || 'Untitled task'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {notCompleted ? 'Not completed' : timeLabel ?? 'Open'}
            </Typography>
        </Stack>
    );
}
