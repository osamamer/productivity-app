import { useMemo, useState } from 'react';
import { Alert, Box, Button, ButtonGroup, Card, Divider, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { useDayOverview } from '../../../hooks/useDayOverview';
import { buildPlannedLane, buildScreenLane } from '../../day/dayTimelineLayout';
import { plannedItems } from '../../day/plannedItems';
import { didItems } from '../../day/didItems';
import { useActivityTimer } from '../../../hooks/useActivityTimer';
import { formatScreenDuration } from '../../day/screenTimeText';
import { ScreenTimeSetup } from '../../day/ScreenTimeSetup';
import { ScreenTimeSummary } from '../../day/ScreenTimeSummary';
import { useScreenTime } from '../../day/useScreenTime';
import { DayColumns } from './DayColumns';
import { QuickChunkPopover, type ChunkDraft } from './QuickChunkPopover';
import { useActivities } from '../../../hooks/useActivities';
import { ActivitySuggestions } from '../../activity/ActivitySuggestions';
import { CalendarEvent, CalendarEventInput } from '../../../types/CalendarEvent';

export type CalendarGridView = 'dayGridWeek' | 'dayGridMonth';

interface CalendarDayViewProps {
    date: string;
    onChangeDate: (date: string) => void;
    onShowGrid: (view: CalendarGridView) => void;
    onCreateEvent: (input: CalendarEventInput) => Promise<CalendarEvent>;
}

function shiftDate(date: string, days: number) {
    return format(addDays(parseISO(`${date}T12:00:00`), days), 'yyyy-MM-dd');
}

/** The calendar's day view: a tall timeline of the plan beside screen time, with totals alongside. */
export function CalendarDayView({ date, onChangeDate, onShowGrid, onCreateEvent }: CalendarDayViewProps) {
    const { overview, error, mutate } = useDayOverview(date);
    const activities = useActivities();
    // A timer started elsewhere shows up in the Did lane before the overview refetches.
    const { current: runningTimer } = useActivityTimer();
    const [draft, setDraft] = useState<ChunkDraft | null>(null);
    const createChunk = async (input: CalendarEventInput) => {
        const created = await onCreateEvent(input);
        mutate(current => ({ ...current, events: [...current.events, created] }));
    };
    const start = overview ? parseISO(overview.dayStart).getTime() : 0;
    const end = overview ? parseISO(overview.dayEnd).getTime() : 0;
    const screenWindow = useMemo(() => (overview ? { start, end } : undefined), [overview, start, end]);
    const { available, status, range, error: screenError, saveSettings } = useScreenTime(screenWindow);
    const screenOn = available && Boolean(status?.settings.enabled) && Boolean(status?.supported);
    const dayStarted = overview !== null && start < Date.now();

    const layout = useMemo(() => {
        if (!overview) return null;
        // `range` changes every refresh, which is when "now" should move too.
        const now = Date.now();
        const apps = range?.apps ?? {};
        const planned = buildPlannedLane(plannedItems(overview, new Date(start), new Date(end), now, activities ?? []), start, end);
        const sessions = overview.activitySessions ?? [];
        const timed = runningTimer && !sessions.some(session => session.id === runningTimer.id) ? [...sessions, runningTimer] : sessions;
        return {
            now,
            planned,
            did: buildPlannedLane(didItems(timed, activities ?? [], now), start, end),
            plannedMs: planned.reduce((total, block) => total + block.end - block.start, 0),
            screen: buildScreenLane({ segments: range?.segments ?? [], tracked: range?.tracked ?? [], nameOf: appId => apps[appId]?.name ?? appId }, start, end, now),
        };
    }, [overview, range, start, end, activities, runningTimer]);

    const day = parseISO(`${date}T12:00:00`);

    return (
        <Stack sx={{ flex: 1, minHeight: 0, gap: 1.5, textAlign: 'left' }}>
            {/* On phones the floating menu button sits over the top-left corner. */}
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ pl: { xs: 6, sm: 0 } }}>
                <IconButton aria-label="Previous day" onClick={() => onChangeDate(shiftDate(date, -1))}><ChevronLeftRoundedIcon /></IconButton>
                <IconButton aria-label="Next day" onClick={() => onChangeDate(shiftDate(date, 1))}><ChevronRightRoundedIcon /></IconButton>
                <Button size="small" variant="outlined" disabled={isToday(day)} onClick={() => onChangeDate(format(new Date(), 'yyyy-MM-dd'))}>Today</Button>
                <Typography variant="h5" fontWeight={700} sx={{ flex: 1, minWidth: 200, ml: 1 }}>{format(day, 'EEEE, MMMM d')}</Typography>
                <ButtonGroup size="small" aria-label="Calendar view">
                    <Button variant="contained" aria-pressed="true">Day</Button>
                    <Button onClick={() => onShowGrid('dayGridWeek')}>Week</Button>
                    <Button onClick={() => onShowGrid('dayGridMonth')}>Month</Button>
                </ButtonGroup>
            </Stack>

            {error && <Alert severity={overview ? 'warning' : 'error'}>{overview ? 'Could not refresh this day; showing what was loaded before.' : error}</Alert>}

            <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, gridTemplateRows: { xs: 'minmax(420px, 1fr) auto', lg: 'minmax(0, 1fr)' } }}>
                <Card variant="outlined" data-day-scroller sx={{ minHeight: 0, overflowY: 'auto', px: { xs: 0.5, sm: 1 } }}>
                    {!layout ? (
                        <Skeleton variant="rounded" height={480} sx={{ m: 2 }} />
                    ) : (
                        <DayColumns
                            windowStart={start}
                            windowEnd={end}
                            now={layout.now}
                            planned={layout.planned}
                            did={layout.did}
                            screen={screenOn && dayStarted ? layout.screen.blocks : null}
                            onCreateAt={(slot, anchor) => setDraft({ ...slot, anchor })}
                        />
                    )}
                </Card>

                <Stack spacing={2} sx={{ minHeight: 0, overflowY: { lg: 'auto' } }}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" spacing={3}>
                            <Box>
                                <Typography variant="h6" fontWeight={700}>{layout ? formatScreenDuration(layout.plannedMs) : '–'}</Typography>
                                <Typography variant="caption" color="text.secondary">Planned on the clock</Typography>
                            </Box>
                            {screenOn && dayStarted && (
                                <Box>
                                    <Typography variant="h6" fontWeight={700}>{layout ? formatScreenDuration(layout.screen.totalMs) : '–'}</Typography>
                                    <Typography variant="caption" color="text.secondary">On screen</Typography>
                                </Box>
                            )}
                        </Stack>
                        {overview && (
                            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                                {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                            </Typography>
                        )}
                        <Tooltip title="Tasks, stats, notes and sessions for this day">
                            <Button component={RouterLink} to={`/day/${date}`} state={{ returnTo: `/calendar?day=${date}` }} size="small" endIcon={<OpenInNewRoundedIcon fontSize="small" />} sx={{ mt: 1, ml: -1 }}>
                                Open day page
                            </Button>
                        </Tooltip>
                    </Card>

                    {activities?.length === 0 && (
                        <Card variant="outlined" sx={{ p: 2 }}>
                            <ActivitySuggestions />
                        </Card>
                    )}

                    {available && dayStarted && (
                        <Card variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Where the day went</Typography>
                            {screenError && <Alert severity="warning" sx={{ mb: 1.5 }}>{screenError}</Alert>}
                            {!status ? (
                                <Skeleton variant="rounded" height={120} />
                            ) : !status.settings.enabled ? (
                                <ScreenTimeSetup settings={status.settings} onSave={saveSettings} />
                            ) : !status.supported ? (
                                <Alert severity="info">{status.reason ?? 'Screen time cannot run on this desktop.'}</Alert>
                            ) : layout && (
                                <>
                                    <ScreenTimeSummary appTimes={layout.screen.appTimes} apps={range?.apps ?? {}} />
                                    <Divider sx={{ my: 1.5 }} />
                                    <Button component={RouterLink} to="/wellbeing/report" size="small" sx={{ ml: -1 }}>See the longer report</Button>
                                </>
                            )}
                        </Card>
                    )}
                </Stack>
            </Box>
            <QuickChunkPopover draft={draft} activities={activities ?? []} onClose={() => setDraft(null)} onCreate={createChunk} />
        </Stack>
    );
}
