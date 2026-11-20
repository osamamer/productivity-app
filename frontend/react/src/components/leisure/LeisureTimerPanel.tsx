import { useState } from 'react';
import { Box, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { format } from 'date-fns';
import { activityTimerStore } from '../../services/cache/activityTimerStore';
import { ActivitySession, sessionElapsedMs } from '../../types/ActivitySession';
import { TIMER_DIGITS_SX } from '../timer/timerDigits';
import { formatScreenDuration } from '../day/screenTimeText';
import { formatClock } from './leisureTime';
import { TimerClock } from './timerClock';

/** The running timer laid out like the Home pomodoro panel, without focus sessions. */
export function LeisureTimerPanel({ session, clock, onStopped }: {
    session: ActivitySession;
    clock: TimerClock;
    // Called once the timer is stopped, with how long it ran, so the page can confirm it.
    onStopped: (elapsedMs: number) => void;
}) {
    const theme = useTheme();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const restColor = theme.palette.mode === 'dark' ? '#9BC5A3' : '#7EA88A';
    const timeUp = clock.remainingMs !== null && clock.remainingMs <= 0;
    const endsAt = session.targetEndAt ? format(Date.parse(session.targetEndAt), 'h:mm a') : null;
    const caption = session.paused ? 'Paused' : timeUp ? "Time's up" : endsAt ? `Ends ${endsAt}` : 'Running';
    const playPauseLabel = session.paused ? 'Resume timer' : 'Pause timer';

    const act = async (action: () => Promise<void>, failure: string) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (actionError) {
            console.error(failure, actionError);
            setError(failure);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ textAlign: 'center', minHeight: 34, ml: 0.5, display: 'flex', justifyContent: 'center', flexDirection: 'column' }}>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            width: '100%',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            whiteSpace: 'nowrap',
                            color: session.paused ? restColor : theme.palette.primary.light,
                        }}
                    >
                        {caption}
                    </Typography>
                    <Typography
                        variant="h4"
                        aria-live="off"
                        sx={{ ...TIMER_DIGITS_SX, flexShrink: 0, fontWeight: 700, lineHeight: 1, px: '24px' }}
                    >
                        {formatClock(clock.remainingMs !== null ? Math.max(0, clock.remainingMs) : clock.elapsedMs)}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                    <Tooltip title={playPauseLabel}>
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                aria-label={playPauseLabel}
                                disabled={busy}
                                onClick={() => void (session.paused
                                    ? act(() => activityTimerStore.resume(session), 'Could not resume the timer.')
                                    : act(() => activityTimerStore.pause(session), 'Could not pause the timer.'))}
                            >
                                {session.paused ? <PlayArrowIcon /> : <PauseIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Stop timer">
                        <span>
                            <IconButton
                                size="small"
                                color="inherit"
                                aria-label="Stop timer"
                                disabled={busy}
                                onClick={() => void act(async () => {
                                    const elapsedMs = sessionElapsedMs(session, Date.now());
                                    await activityTimerStore.end(session);
                                    onStopped(elapsedMs);
                                }, 'Could not stop the timer.')}
                                sx={{
                                    color: 'error.light',
                                    '&:hover': { color: 'error.main', backgroundColor: alpha(theme.palette.error.main, 0.08) },
                                }}
                            >
                                <StopIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </Box>
            {clock.progress !== null && (
                <Box sx={{ mt: 1.5 }}>
                    <LinearProgress
                        variant="determinate"
                        value={clock.progress}
                        aria-label="Share of the countdown used"
                        sx={{ height: 4, borderRadius: 2, backgroundColor: 'action.hover', '& .MuiLinearProgress-bar': { backgroundColor: session.paused ? restColor : theme.palette.primary.main } }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'left' }}>
                        {timeUp ? 'Finished' : `${formatScreenDuration(Math.max(0, clock.remainingMs ?? 0))} left`}
                    </Typography>
                </Box>
            )}
            {error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'left' }}>{error}</Typography>}
        </Box>
    );
}
