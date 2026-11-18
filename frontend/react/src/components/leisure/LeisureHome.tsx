import { ReactNode, useMemo, useState } from 'react';
import { Alert, Box, Skeleton, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { PageWrapper } from '../PageWrapper';
import { ActivitySuggestions } from '../activity/ActivitySuggestions';
import { ACTIVITY_COLOR_ORDER, activityHex } from '../activity/activityColors';
import { useActivities } from '../../hooks/useActivities';
import { useActivityTimer, useNow } from '../../hooks/useActivityTimer';
import { useDayOverview } from '../../hooks/useDayOverview';
import { useUser } from '../../hooks/useUser';
import { activityStore } from '../../services/cache/activityStore';
import { activityTimerStore } from '../../services/cache/activityTimerStore';
import { Activity, ActivityInput } from '../../types/Activity';
import { ActivitySession } from '../../types/ActivitySession';
import { homeGreeting } from '../../pages/home/homeGreeting';
import { ActivityDetailsPanel } from './ActivityDetailsPanel';
import { LeisurePanel, LeisureRow } from './LeisureRow';
import { LeisureStartPanel } from './LeisureStartPanel';
import { LeisureTimerPanel } from './LeisureTimerPanel';
import { TimedTodayList } from './TimedTodayList';
import { timerClock } from './timerClock';

const MINUTE = 60_000;

type OpenPanel = { activityId: string; panel: LeisurePanel } | null;

/** The leisure counterpart of the Home task input: adds an activity. */
function AddActivityInput({ count, onError }: { count: number; onError: (message: string | null) => void }) {
    const [name, setName] = useState('');
    const add = async () => {
        if (!name.trim()) return;
        onError(null);
        try {
            await activityStore.create({ name: name.trim(), color: ACTIVITY_COLOR_ORDER[count % ACTIVITY_COLOR_ORDER.length], displayOrder: count });
            setName('');
        } catch (error) {
            console.error('Could not add the activity:', error);
            onError('Could not add the activity.');
        }
    };
    return (
        <Box component="form" onSubmit={event => { event.preventDefault(); void add(); }}>
            <TextField
                variant="standard"
                fullWidth
                placeholder="Add an activity..."
                value={name}
                autoComplete="off"
                onChange={event => setName(event.target.value)}
                inputProps={{ 'aria-label': 'Add an activity', maxLength: 60 }}
            />
        </Box>
    );
}

/** The leisure side of Home: your activities as rows, each with a timer drawn like the Home pomodoro. */
export function LeisureHome({ modeSwitch }: { modeSwitch: ReactNode }) {
    const theme = useTheme();
    const { user } = useUser();
    const { current: session, loaded } = useActivityTimer();
    const now = useNow(true, session && !session.paused ? 1000 : 30_000);
    const { overview } = useDayOverview(format(now, 'yyyy-MM-dd'));
    const activities = useActivities();
    const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
    const [error, setError] = useState<string | null>(null);

    const sessions = useMemo(() => {
        const listed = overview?.activitySessions ?? [];
        // The running timer may be newer than the overview.
        return session && !listed.some(item => item.id === session.id) ? [...listed, session] : listed;
    }, [overview, session]);

    const togglePanel = (activityId: string, panel: LeisurePanel) => setOpenPanel(previous =>
        previous?.activityId === activityId && previous.panel === panel ? null : { activityId, panel });

    const report = (failure: string) => (cause: unknown) => {
        console.error(failure, cause);
        setError(failure);
    };
    const update = (activity: Activity, input: ActivityInput) =>
        activityStore.update(activity.id, input).catch(report('Could not save the activity.'));

    const start = (activity: Activity) => async (minutes: number) => {
        await activityTimerStore.start({
            activityId: activity.id,
            title: activity.name,
            targetEndAt: minutes > 0 ? new Date(Date.now() + minutes * MINUTE).toISOString() : null,
        });
        setOpenPanel(null);
    };

    const timerPanel = (running: ActivitySession, label: string) =>
        <LeisureTimerPanel session={running} clock={timerClock(running, now)} label={label} />;

    const renderActivity = (activity: Activity) => {
        const running = session?.activityId === activity.id ? session : null;
        const panel = openPanel?.activityId === activity.id ? openPanel.panel : null;
        const clock = running ? timerClock(running, now) : null;
        return (
            <LeisureRow
                key={activity.id}
                title={activity.name}
                color={activityHex(activity.color, theme.palette.text.secondary)}
                active={Boolean(running)}
                paused={running?.paused}
                progress={clock?.progress ?? null}
                panel={panel}
                onTogglePanel={next => togglePanel(activity.id, next)}
                timerDisabled={Boolean(session) && !running}
                onRename={name => void update(activity, { name })}
                onDelete={() => void activityStore.remove(activity.id).catch(report('Could not delete the activity.'))}
            >
                {panel === 'details' && (
                    <Box sx={{ mb: running ? 2 : 0 }}>
                        <ActivityDetailsPanel color={activity.color} onChange={color => void update(activity, { color })} />
                    </Box>
                )}
                {running
                    ? timerPanel(running, activity.name)
                    : panel === 'timer' && <LeisureStartPanel defaultMinutes={0} onStart={start(activity)} />}
            </LeisureRow>
        );
    };

    // A timer that belongs to no listed activity still shows, as its own row on top.
    const orphan = session && !activities?.some(activity => activity.id === session.activityId) ? session : null;
    const firstName = user?.firstName || user?.username || '';

    return (
        <PageWrapper>
            <Box sx={{ position: 'relative', flex: 1 }}>
                {modeSwitch}
                <Box sx={{ maxWidth: 500, width: '100%', mx: 'auto', pt: 10, pb: 8, px: 2 }}>
                    <Typography variant="h4" color="text.secondary" sx={{ mb: 4, fontWeight: 400 }}>
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
                        <AddActivityInput count={activities?.length ?? 0} onError={setError} />
                    </Box>

                    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

                    {!loaded || activities === null ? (
                        <Box>
                            {[0, 1, 2].map(index => <Skeleton key={index} variant="rounded" height={48} sx={{ mb: 0.75, borderRadius: 1.5 }} />)}
                        </Box>
                    ) : (
                        <>
                            {orphan && (
                                <LeisureRow
                                    title={orphan.title}
                                    color={null}
                                    active
                                    paused={orphan.paused}
                                    progress={timerClock(orphan, now).progress}
                                    panel={null}
                                    onTogglePanel={() => undefined}
                                >
                                    {timerPanel(orphan, 'Timing')}
                                </LeisureRow>
                            )}
                            {activities.map(renderActivity)}
                            {activities.length === 0 && (
                                <Box sx={{ mt: 1, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
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
