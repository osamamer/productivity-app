import { ReactNode, useMemo, useState } from 'react';
import { Box, Link, Skeleton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { PageWrapper } from '../PageWrapper';
import { ActivitySuggestions } from '../activity/ActivitySuggestions';
import { activityHex } from '../activity/activityColors';
import { useActivities } from '../../hooks/useActivities';
import { useActivityTimer, useNow } from '../../hooks/useActivityTimer';
import { useDayOverview } from '../../hooks/useDayOverview';
import { useUser } from '../../hooks/useUser';
import { activityTimerStore } from '../../services/cache/activityTimerStore';
import { Activity } from '../../types/Activity';
import { ActivitySession, StartActivitySessionInput } from '../../types/ActivitySession';
import { homeGreeting } from '../../pages/home/homeGreeting';
import { LeisureRow } from './LeisureRow';
import { LeisureStartInput } from './LeisureStartInput';
import { LeisureStartPanel } from './LeisureStartPanel';
import { LeisureTimerPanel } from './LeisureTimerPanel';
import { TimedTodayList } from './TimedTodayList';
import { nowPlan, PlannedChunk } from './nowPlan';
import { timerClock } from './timerClock';
import { todayChunks } from './todayChunks';

const MINUTE = 60_000;

function chunkDefaultMinutes(chunk: PlannedChunk, now: number): number {
    if (chunk.end <= now) return 0;
    return Math.ceil((chunk.end - Math.max(now, chunk.start)) / MINUTE);
}

function chunkSubtitle(chunk: PlannedChunk, activity: Activity | undefined, current: boolean): string {
    const range = `${format(chunk.start, 'h:mm a')} – ${format(chunk.end, 'h:mm a')}`;
    return `${current ? 'Now · ' : ''}${range}${activity ? ` · ${activity.name}` : ''}`;
}

/** The leisure side of Home: today's planned chunks as rows and a timer drawn like the pomodoro. */
export function LeisureHome({ modeSwitch }: { modeSwitch: ReactNode }) {
    const theme = useTheme();
    const { user } = useUser();
    const { current: session, loaded } = useActivityTimer();
    const now = useNow(true, session && !session.paused ? 1000 : 30_000);
    const today = format(now, 'yyyy-MM-dd');
    const { overview } = useDayOverview(today);
    const activities = useActivities();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const plan = useMemo(() => nowPlan(overview ? todayChunks(overview) : [], now), [overview, now]);
    const sessions = useMemo(() => {
        const listed = overview?.activitySessions ?? [];
        // The running timer may be newer than the overview.
        return session && !listed.some(item => item.id === session.id) ? [...listed, session] : listed;
    }, [overview, session]);
    const byId = useMemo(() => new Map((activities ?? []).map(activity => [activity.id, activity])), [activities]);
    const colorOf = (activityId: string | null) => {
        const activity = activityId ? byId.get(activityId) : undefined;
        return activity ? activityHex(activity.color, theme.palette.text.secondary) : null;
    };

    const start = async (input: StartActivitySessionInput) => {
        await activityTimerStore.start(input);
        setExpandedId(null);
    };
    const startChunk = (chunk: PlannedChunk) => async (minutes: number) => {
        const untilChunkEnd = minutes === chunkDefaultMinutes(chunk, Date.now()) && chunk.end > Date.now();
        const targetEndAt = minutes <= 0 ? null
            : new Date(untilChunkEnd ? chunk.end : Date.now() + minutes * MINUTE).toISOString();
        await start({ activityId: chunk.activityId, eventId: chunk.eventId, title: chunk.title, targetEndAt });
    };

    const renderRunning = (running: ActivitySession) => {
        const clock = timerClock(running, now);
        const activity = running.activityId ? byId.get(running.activityId) : undefined;
        return (
            <LeisureRow
                title={running.title}
                subtitle={`Since ${format(Date.parse(running.startedAt), 'h:mm a')}${running.targetEndAt ? ` · until ${format(Date.parse(running.targetEndAt), 'h:mm a')}` : ''}`}
                color={colorOf(running.activityId)}
                active
                paused={running.paused}
                progress={clock.progress}
                expanded
                onToggle={() => undefined}
            >
                <LeisureTimerPanel session={running} clock={clock} label={activity?.name ?? 'Timing'} />
            </LeisureRow>
        );
    };

    const renderChunk = (chunk: PlannedChunk, state: 'now' | 'later' | 'past') => {
        const activity = chunk.activityId ? byId.get(chunk.activityId) : undefined;
        const expanded = expandedId === chunk.id;
        return (
            <LeisureRow
                key={chunk.id}
                title={chunk.title}
                subtitle={chunkSubtitle(chunk, activity, state === 'now')}
                color={colorOf(chunk.activityId)}
                current={state === 'now'}
                dimmed={state === 'past'}
                expanded={expanded}
                timerDisabled={Boolean(session)}
                onToggle={() => setExpandedId(expanded ? null : chunk.id)}
            >
                <LeisureStartPanel defaultMinutes={chunkDefaultMinutes(chunk, now)} onStart={startChunk(chunk)} />
            </LeisureRow>
        );
    };

    // Like a focused pomodoro task, the running timer sits on top and its chunk leaves the list below.
    const runningChunkId = session?.eventId
        ? [plan.current, ...plan.upcoming, ...plan.past].find(chunk => chunk?.eventId === session.eventId)?.id
        : undefined;
    const showChunk = (chunk: PlannedChunk) => chunk.id !== runningChunkId;
    const planEmpty = !plan.current && plan.upcoming.length === 0 && plan.past.length === 0;
    const firstName = user?.firstName || user?.username || '';

    return (
        <PageWrapper>
            <Box sx={{ position: 'relative', flex: 1 }}>
                {modeSwitch}
                <Box sx={{ maxWidth: 500, width: '100%', mx: 'auto', pt: 10, pb: 8, px: 2 }}>
                    <Typography variant="h4" color="text.secondary" sx={{ mb: 4, fontWeight: 400, textAlign: 'left' }}>
                        {homeGreeting(new Date(now).getHours(), firstName)}
                    </Typography>

                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: 3,
                            px: 2.5,
                            py: 1.5,
                            mb: 5,
                            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                            '& .MuiInput-underline:before': { borderBottom: 'none' },
                            '& .MuiInput-underline:after': { borderBottom: 'none' },
                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                            '& .MuiInput-root': { fontSize: '1.1rem' },
                        }}
                    >
                        <LeisureStartInput activities={activities ?? []} disabled={Boolean(session)} onStart={start} />
                    </Box>

                    {!loaded || !overview || activities === null ? (
                        <Box>
                            {[0, 1, 2].map(index => <Skeleton key={index} variant="rounded" height={48} sx={{ mb: 0.75, borderRadius: 1.5 }} />)}
                        </Box>
                    ) : (
                        <>
                            {session && renderRunning(session)}
                            {plan.current && showChunk(plan.current) && renderChunk(plan.current, 'now')}
                            {plan.upcoming.filter(showChunk).map(chunk => renderChunk(chunk, 'later'))}
                            {plan.past.filter(showChunk).map(chunk => renderChunk(chunk, 'past'))}
                            {planEmpty && (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left', px: 1, mt: session ? 2 : 0 }}>
                                    Nothing planned on the clock today.{' '}
                                    <Link component={RouterLink} to={`/calendar?day=${today}`}>Plan chunks in the day view</Link>.
                                </Typography>
                            )}
                            {activities.length === 0 && (
                                <Box sx={{ mt: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 2, textAlign: 'left' }}>
                                    <ActivitySuggestions />
                                </Box>
                            )}
                            <TimedTodayList sessions={sessions} activities={activities} now={now} />
                        </>
                    )}
                </Box>
            </Box>
        </PageWrapper>
    );
}
