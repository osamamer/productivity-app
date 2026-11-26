import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RemoveIcon from '@mui/icons-material/Remove';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import type { PomodoroStatus } from '../../types/PomodoroStatus';
import { TIMER_DIGITS_SX } from '../timer/timerDigits';
import { WhiteNoiseControl } from '../timer/WhiteNoiseControl';
import { formatSeconds } from './taskRowHelpers';

type PomodoroRunningControlsProps = {
    status: PomodoroStatus;
    waitingForPhase: boolean;
    isBreak: boolean;
    timeAdjustmentMinutes: number;
    canAdjustTime: boolean;
    onAdjustTime: (deltaSeconds: number) => void;
    playPauseLabel: string;
    onPlayPause: () => void;
    onFinishBreak: () => void;
    canStartBreakEarly: boolean;
    endOptionsOpen: boolean;
    onToggleEndOptions: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

/** The phase, countdown, focus dots and controls of a task row's running Pomodoro. */
export function PomodoroRunningControls({
    status,
    waitingForPhase,
    isBreak,
    timeAdjustmentMinutes,
    canAdjustTime,
    onAdjustTime,
    playPauseLabel,
    onPlayPause,
    onFinishBreak,
    canStartBreakEarly,
    endOptionsOpen,
    onToggleEndOptions,
}: PomodoroRunningControlsProps) {
    const theme = useTheme();
    const accent = theme.palette.primary.light;
    const activeAccent = theme.palette.primary.main;
    const pomodoroGreen = theme.palette.mode === 'dark' ? '#9BC5A3' : '#7EA88A';
    const timeAdjustmentLabel = `${timeAdjustmentMinutes} ${timeAdjustmentMinutes === 1 ? 'minute' : 'minutes'}`;
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
                textAlign: waitingForPhase ? 'left' : 'center',
                minHeight: 34,
                ml: waitingForPhase ? 1 : 0.5,
                display: 'flex',
                justifyContent: 'center',
                alignItems: waitingForPhase ? 'flex-start' : 'center',
                flexDirection: 'column',
            }}>
                <Typography
                    variant={waitingForPhase ? 'h5' : 'caption'}
                    sx={{
                        display: 'block',
                        textAlign: waitingForPhase ? 'left' : 'center',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: waitingForPhase ? 1.1 : 1,
                        lineHeight: waitingForPhase ? 0.95 : undefined,
                        whiteSpace: waitingForPhase ? 'normal' : 'nowrap',
                        color: isBreak ? pomodoroGreen : accent,
                    }}
                >
                    {waitingForPhase
                        ? (status.phase === 'WAITING_FOR_BREAK' ? ['BREAK', 'TIME'] : ['WORK', 'TIME']).map(word => (
                            <Box component="span" key={word} sx={{ display: 'block' }}>
                                {word}
                            </Box>
                        ))
                        : isBreak ? 'BREAK TIME' : 'WORK TIME'}
                </Typography>
                {!waitingForPhase && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            '& .pomodoro-time-adjustment': {
                                opacity: 0,
                                transition: 'opacity 120ms ease',
                                color: 'text.secondary',
                            },
                            '&:hover .pomodoro-time-adjustment, &:focus-within .pomodoro-time-adjustment': {
                                opacity: 1,
                            },
                            '@media (hover: none)': {
                                '& .pomodoro-time-adjustment': { opacity: 1 },
                            },
                        }}
                    >
                        <Tooltip title={`Remove ${timeAdjustmentLabel}`} placement="top">
                            <span>
                                <IconButton
                                    className="pomodoro-time-adjustment"
                                    size="small"
                                    disabled={!canAdjustTime}
                                    aria-label={`Remove ${timeAdjustmentLabel} from the current Pomodoro phase`}
                                    onClick={event => {
                                        event.stopPropagation();
                                        onAdjustTime(-timeAdjustmentMinutes * 60);
                                    }}
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        p: 0,
                                        '&:hover': {
                                            color: 'primary.main',
                                            backgroundColor: alpha(activeAccent, 0.08),
                                        },
                                    }}
                                >
                                    <RemoveIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Typography
                            variant="h4"
                            sx={{
                                ...TIMER_DIGITS_SX,
                                flexShrink: 0,
                                fontWeight: 700,
                                lineHeight: 1,
                            }}
                        >
                            {formatSeconds(status.secondsUntilNextTransition)}
                        </Typography>
                        <Tooltip title={`Add ${timeAdjustmentLabel}`} placement="top">
                            <span>
                                <IconButton
                                    className="pomodoro-time-adjustment"
                                    size="small"
                                    disabled={!canAdjustTime}
                                    aria-label={`Add ${timeAdjustmentLabel} to the current Pomodoro phase`}
                                    onClick={event => {
                                        event.stopPropagation();
                                        onAdjustTime(timeAdjustmentMinutes * 60);
                                    }}
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        p: 0,
                                        '&:hover': {
                                            color: 'primary.main',
                                            backgroundColor: alpha(activeAccent, 0.08),
                                        },
                                    }}
                                >
                                    <AddIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                )}
            </Box>

            {/* Focus dots — lighter inactive shade */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {Array.from({ length: status.numFocuses }).map((_, i) => (
                    <Box
                        key={i}
                        sx={{
                            width: 8, height: 8, borderRadius: '50%',
                            backgroundColor: i < status.currentFocusNumber
                                ? accent
                                : alpha(accent, 0.12),
                            transition: 'background-color 0.3s',
                        }}
                    />
                ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                <WhiteNoiseControl size="small" />
                {(waitingForPhase || !isBreak) && (
                    <Tooltip title={playPauseLabel}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={onPlayPause}
                                color={status.phase === 'WAITING_FOR_BREAK' ? 'inherit' : 'primary'}
                                aria-label={playPauseLabel}
                                sx={status.phase === 'WAITING_FOR_BREAK' ? { color: pomodoroGreen } : undefined}
                            >
                                {!waitingForPhase && status.sessionRunning ? <PauseIcon /> : <PlayArrowIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
                {status.phase === 'BREAK' && (
                    <Tooltip title="End break and start the next focus session">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onFinishBreak}
                                color="primary"
                                aria-label="End break and start the next focus session"
                            >
                                <SkipNextIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
                <Tooltip title={canStartBreakEarly ? 'End session options' : 'End Pomodoro session'}>
                    <span>
                        <IconButton
                            size="small"
                            onClick={onToggleEndOptions}
                            color="inherit"
                            aria-label={canStartBreakEarly ? 'Open end session options' : 'End Pomodoro session'}
                            aria-haspopup={canStartBreakEarly ? 'true' : undefined}
                            aria-expanded={canStartBreakEarly ? endOptionsOpen : undefined}
                            sx={{
                                color: 'error.light',
                                '&:hover': {
                                    color: 'error.main',
                                    backgroundColor: alpha(theme.palette.error.main, 0.08),
                                },
                            }}
                        >
                            <StopIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
        </Box>
    );
}
