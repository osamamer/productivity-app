import { useMemo } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import CalendarViewDayRoundedIcon from '@mui/icons-material/CalendarViewDayRounded';
import { format } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { PageWrapper } from '../components/PageWrapper';
import { ActivitySuggestions } from '../components/activity/ActivitySuggestions';
import { nowPlan } from '../components/now/nowPlan';
import { StartCard } from '../components/now/StartCard';
import { TimedTodayCard } from '../components/now/TimedTodayCard';
import { TimerCard } from '../components/now/TimerCard';
import { TodayPlanCard } from '../components/now/TodayPlanCard';
import { todayChunks } from '../components/now/todayChunks';
import { useActivities } from '../hooks/useActivities';
import { useActivityTimer, useNow } from '../hooks/useActivityTimer';
import { useDayOverview } from '../hooks/useDayOverview';

/** What the plan says right now, and a timer for whatever you are actually doing. */
export function NowPage() {
    // Ticks every 30 s so the current chunk and totals move on without a reload.
    const now = useNow(true, 30_000);
    const today = format(now, 'yyyy-MM-dd');
    const { overview } = useDayOverview(today);
    const activities = useActivities();
    const { current, loaded } = useActivityTimer();
    const plan = useMemo(() => nowPlan(overview ? todayChunks(overview) : [], now), [overview, now]);
    const sessions = useMemo(() => {
        const listed = overview?.activitySessions ?? [];
        // The running timer may be newer than the overview.
        return current && !listed.some(session => session.id === current.id) ? [...listed, current] : listed;
    }, [overview, current]);
    const currentActivity = activities?.find(activity => activity.id === current?.activityId);

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto', py: { xs: 3, md: 5 }, textAlign: 'left' }}>
                <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{ mb: { xs: 2, md: 3 }, pl: { xs: 6, sm: 0 } }}>
                    <Box>
                        <Typography variant="h4" fontWeight={750} sx={{ letterSpacing: '-0.03em' }}>Now</Typography>
                        <Typography color="text.secondary">
                            {format(now, 'EEEE, MMMM d · h:mm a')}
                            {plan.current ? ` · planned: ${plan.current.title} until ${format(plan.current.end, 'h:mm a')}` : ''}
                        </Typography>
                    </Box>
                    <Button component={RouterLink} to={`/calendar?day=${today}`} startIcon={<CalendarViewDayRoundedIcon />} sx={{ flexShrink: 0 }}>
                        Day view
                    </Button>
                </Stack>

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }, alignItems: 'start' }}>
                    <Stack spacing={2}>
                        {!loaded || activities === null ? (
                            <Skeleton variant="rounded" height={260} />
                        ) : current ? (
                            <TimerCard session={current} activity={currentActivity} />
                        ) : (
                            <StartCard chunk={plan.current} activities={activities} />
                        )}
                        {activities?.length === 0 && <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}><ActivitySuggestions /></Box>}
                    </Stack>
                    <Stack spacing={2}>
                        {overview ? <TodayPlanCard plan={plan} activities={activities ?? []} /> : <Skeleton variant="rounded" height={180} />}
                        {overview && <TimedTodayCard sessions={sessions} activities={activities ?? []} now={now} />}
                    </Stack>
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default NowPage;
