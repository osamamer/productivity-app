import { useMemo } from 'react';
import { Alert, Box, Button, Card, Skeleton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { useActivities } from '../../hooks/useActivities';
import { useNow } from '../../hooks/useActivityTimer';
import { useRevalidatingResource } from '../../hooks/useRevalidatingResource';
import { activitySessionService } from '../../services/api/activitySessionService';
import { eventService } from '../../services/api/eventService';
import { RevalidatingResource } from '../../services/cache/revalidatingResource';
import { getAuthCacheScope } from '../../services/utils/authHeaders';
import { Activity } from '../../types/Activity';
import { ActivitySession } from '../../types/ActivitySession';
import { CalendarEvent } from '../../types/CalendarEvent';
import { activityHex } from '../activity/activityColors';
import { expandCalendarEvent } from '../calendar/recurrence';
import { formatScreenDuration } from '../day/screenTimeText';
import { ComparisonBars } from './ComparisonBars';
import { compareByActivity, compareByBucket, timedSpan, type ActivityComparison, type Span } from './planVsTimed';
import { reportWindow, type ReportPeriod } from './screenTimeReport';
import { StatTile } from './StatTile';

const KEEP_MS = 24 * 60 * 60 * 1000;
const eventsResource = new RevalidatingResource<CalendarEvent[]>({ keepMs: KEEP_MS, maxEntries: 2 });
const sessionsResource = new RevalidatingResource<ActivitySession[]>({ keepMs: KEEP_MS, maxEntries: 8 });

function plannedSpans(events: CalendarEvent[], from: Date, to: Date): Span[] {
    return events.filter(event => event.activityId).flatMap(event => expandCalendarEvent(event, from, to)
        .filter(occurrence => !occurrence.allDay && occurrence.status !== 'CANCELLED')
        .map(occurrence => ({ activityId: event.activityId ?? null, start: parseISO(occurrence.start).getTime(), end: parseISO(occurrence.end).getTime() })));
}

// `scaleMs` is shared by every row, so bar lengths compare across activities.
function ActivityRow({ row, activity, scaleMs }: { row: ActivityComparison; activity: Activity | undefined; scaleMs: number }) {
    const theme = useTheme();
    const color = activityHex(activity?.color, theme.palette.text.secondary);
    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="baseline">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={650} noWrap>{activity?.name ?? 'Other timers'}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {row.timedMs > 0 ? `${formatScreenDuration(row.timedMs)} timed` : 'nothing timed'}{row.plannedMs > 0 ? ` · ${formatScreenDuration(row.plannedMs)} planned` : ''}
                </Typography>
            </Stack>
            <Stack spacing="3px" sx={{ mt: 0.75 }}>
                {row.plannedMs > 0 && (
                    <Box sx={{ height: 6, width: `${(row.plannedMs / scaleMs) * 100}%`, borderRadius: 3, border: `1.5px solid ${color}`, bgcolor: alpha(color, 0.12) }} aria-hidden />
                )}
                <Box sx={{ height: 6, width: `${(row.timedMs / scaleMs) * 100}%`, minWidth: row.timedMs ? 4 : 0, borderRadius: 3, bgcolor: color }} aria-hidden />
            </Stack>
        </Box>
    );
}

/** How much time chunks set aside for each activity, beside how much was actually timed. */
export function PlanVsTimedReport({ period }: { period: ReportPeriod }) {
    // Moves "now" on each minute, so today's plans count as their time comes.
    const now = useNow(true, 60_000);
    const window = reportWindow(period, new Date(now));
    const from = window.from.getTime();
    const to = window.to.getTime();
    const scope = getAuthCacheScope();
    const activities = useActivities();
    const events = useRevalidatingResource(eventsResource, `${scope}:events`, () => eventService.getEvents(true), { freshMs: 60_000 });
    const sessions = useRevalidatingResource(
        sessionsResource,
        `${scope}:${from}:${to}`,
        () => activitySessionService.getBetween(new Date(from), new Date(to)),
        { freshMs: 0, keepPrevious: true },
    );

    const report = useMemo(() => {
        if (!events.data || !sessions.data) return null;
        const windowDates = { from: new Date(from), to: new Date(to) };
        const planned = plannedSpans(events.data, windowDates.from, windowDates.to);
        const timed = sessions.data.map(session => timedSpan(session, now));
        const rows = compareByActivity(planned, timed, windowDates, now);
        return {
            rows,
            buckets: compareByBucket(planned, timed, period, windowDates, now),
            plannedMs: rows.reduce((total, row) => total + row.plannedMs, 0),
            timedMs: rows.reduce((total, row) => total + row.timedMs, 0),
            scaleMs: Math.max(1, ...rows.flatMap(row => [row.plannedMs, row.timedMs])),
        };
    }, [events.data, sessions.data, from, to, period, now]);

    const byId = new Map((activities ?? []).map(activity => [activity.id, activity]));
    const error = events.error ?? sessions.error;

    return (
        <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>Planned and timed</Typography>
            {error && <Alert severity="warning">{error}</Alert>}
            {!report ? (
                <Skeleton variant="rounded" height={260} />
            ) : report.rows.length === 0 ? (
                <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Nothing planned or timed in this period yet. Plan chunks in the calendar's day view, and time what you do from Home's Leisure view.
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button component={RouterLink} to={`/calendar?day=${format(now, 'yyyy-MM-dd')}`} variant="outlined" size="small">Day view</Button>
                        <Button component={RouterLink} to="/?mode=leisure" variant="outlined" size="small">Leisure</Button>
                    </Stack>
                </Card>
            ) : (
                <Stack spacing={2} sx={{ opacity: sessions.previous ? 0.55 : 1, transition: 'opacity 160ms ease' }} aria-busy={sessions.previous}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <StatTile value={formatScreenDuration(report.plannedMs)} label="Planned in chunks, so far" />
                        <StatTile value={formatScreenDuration(report.timedMs)} label="Timed" />
                    </Stack>
                    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>By activity</Typography>
                        <Stack spacing={1.75}>
                            {report.rows.map(row => <ActivityRow key={row.activityId ?? 'none'} row={row} activity={row.activityId ? byId.get(row.activityId) : undefined} scaleMs={report.scaleMs} />)}
                        </Stack>
                    </Card>
                    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Over time</Typography>
                        <ComparisonBars buckets={report.buckets} />
                    </Card>
                </Stack>
            )}
        </Stack>
    );
}
