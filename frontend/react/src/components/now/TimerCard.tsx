import { useState } from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { format } from 'date-fns';
import { useNow } from '../../hooks/useActivityTimer';
import { activityTimerStore } from '../../services/cache/activityTimerStore';
import { Activity } from '../../types/Activity';
import { ActivitySession, sessionElapsedMs } from '../../types/ActivitySession';
import { activityHex } from '../activity/activityColors';
import { TIMER_DIGITS_SX } from '../timer/timerDigits';
import { formatClock } from './nowPlan';

/** The running timer, large: elapsed time (or time left in a countdown), pause and stop. */
export function TimerCard({ session, activity }: { session: ActivitySession; activity: Activity | undefined }) {
    const theme = useTheme();
    const now = useNow(!session.paused);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const color = activityHex(activity?.color, theme.palette.primary.main);
    const elapsed = sessionElapsedMs(session, now);
    const target = session.targetEndAt ? Date.parse(session.targetEndAt) : null;
    const total = target ? target - Date.parse(session.startedAt) - session.pausedMillis : null;
    const remaining = total !== null ? total - elapsed : null;

    const act = async (action: () => Promise<void>, failure: string) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (actionError) {
            console.error(failure, actionError);
            setError(actionError instanceof Error ? actionError.message : failure);
        } finally {
            setBusy(false);
        }
    };

    const progress = total !== null ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : null;

    return (
        <Card variant="outlined" sx={{
            position: 'relative', p: { xs: 2.5, sm: 4 }, borderColor: color, bgcolor: alpha(color, 0.06), textAlign: 'center',
            ...(progress !== null && { borderBottomColor: 'transparent' }),
        }}>
            <Stack spacing={2} alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                    <Typography variant="h6" fontWeight={700}>{session.title}</Typography>
                </Stack>
                <Typography
                    component="div"
                    aria-live="off"
                    variant="h3"
                    fontWeight="bold"
                    sx={{ ...TIMER_DIGITS_SX, opacity: session.paused ? 0.5 : 1 }}
                >
                    {formatClock(remaining !== null ? Math.max(0, remaining) : elapsed)}
                </Typography>
                <Typography color="text.secondary">
                    {session.paused
                        ? 'Paused'
                        : remaining !== null
                            ? remaining > 0 ? `left, until ${format(target!, 'h:mm a')}` : `Time's up · ${formatClock(elapsed)} so far`
                            : `since ${format(Date.parse(session.startedAt), 'h:mm a')}`}
                </Typography>
                <Stack direction="row" spacing={1.5}>
                    {session.paused ? (
                        <Button variant="contained" size="large" startIcon={<PlayArrowRoundedIcon />} disabled={busy}
                            onClick={() => void act(() => activityTimerStore.resume(session), 'Could not resume the timer.')}>
                            Resume
                        </Button>
                    ) : (
                        <Button variant="outlined" size="large" startIcon={<PauseRoundedIcon />} disabled={busy}
                            onClick={() => void act(() => activityTimerStore.pause(session), 'Could not pause the timer.')}>
                            Pause
                        </Button>
                    )}
                    <Button variant="outlined" color="inherit" size="large" startIcon={<StopRoundedIcon />} disabled={busy}
                        onClick={() => void act(() => activityTimerStore.end(session), 'Could not stop the timer.')}>
                        Stop
                    </Button>
                </Stack>
                {error && <Alert severity="error">{error}</Alert>}
            </Stack>
            {progress !== null && (
                // The countdown fills the card's bottom edge instead of a separate bar.
                <Box
                    role="progressbar"
                    aria-label="Countdown progress"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: alpha(color, 0.18) }}
                >
                    <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: color, transition: 'width 1s linear' }} />
                </Box>
            )}
        </Card>
    );
}
