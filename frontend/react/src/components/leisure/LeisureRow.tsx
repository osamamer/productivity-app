import { ReactNode } from 'react';
import { Box, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import TimerIcon from '@mui/icons-material/Timer';

const ROW_BORDER_WIDTH = '2px';

const panelReveal = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

interface LeisureRowProps {
    title: string;
    subtitle?: string;
    // The activity colour; null draws a neutral dot.
    color: string | null;
    dimmed?: boolean;
    // Highlights the chunk planned for right now.
    current?: boolean;
    // A timer runs for this row: draws it like a task with a running pomodoro.
    active?: boolean;
    paused?: boolean;
    // 0–100 for a countdown, null for an open timer.
    progress?: number | null;
    expanded: boolean;
    onToggle: () => void;
    timerDisabled?: boolean;
    children: ReactNode;
}

/** One line of the leisure home, drawn like a Home task row; the timer button opens its panel. */
export function LeisureRow({
    title, subtitle, color, dimmed = false, current = false, active = false, paused = false,
    progress = null, expanded, onToggle, timerDisabled = false, children,
}: LeisureRowProps) {
    const theme = useTheme();
    const activeAccent = theme.palette.primary.main;
    const restColor = theme.palette.mode === 'dark' ? '#9BC5A3' : '#7EA88A';
    const borderColor = active ? (paused ? restColor : alpha(activeAccent, 0.7)) : 'transparent';
    const progressColor = paused ? restColor : activeAccent;
    const showProgress = active && progress !== null;
    const background = active ? alpha(activeAccent, 0.05) : current ? alpha(activeAccent, 0.04) : 'transparent';

    return (
        <Box
            sx={{
                position: 'relative',
                borderRadius: 1.5,
                border: `${ROW_BORDER_WIDTH} solid transparent`,
                borderColor,
                borderBottomColor: showProgress ? alpha(progressColor, 0.15) : borderColor,
                backgroundColor: background,
                overflow: active ? 'visible' : 'hidden',
                mb: 0.25,
                opacity: dimmed ? 0.55 : 1,
                transition: 'border-color 0.32s ease, background-color 0.32s ease',
                '&::after': showProgress ? {
                    content: '""',
                    position: 'absolute',
                    inset: `-${ROW_BORDER_WIDTH}`,
                    boxSizing: 'border-box',
                    border: `${ROW_BORDER_WIDTH} solid transparent`,
                    borderBottomColor: borderColor,
                    borderRadius: 'inherit',
                    clipPath: `inset(0 ${100 - (progress ?? 0)}% 0 0)`,
                    pointerEvents: 'none',
                    transition: 'clip-path 0.2s linear',
                } : undefined,
                '&:hover': { backgroundColor: active ? background : alpha(activeAccent, 0.04) },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 0.5 }}>
                <Box sx={{ width: 38, height: 38, mr: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color ?? 'text.disabled' }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{title}</Typography>
                    {subtitle && (
                        <Typography variant="caption" color={current ? 'primary' : 'text.secondary'} sx={{ display: 'block', lineHeight: 1.3 }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
                {!active && (
                    <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5 }}>
                        <Tooltip title={timerDisabled ? 'Stop the running timer first' : 'Timer'}>
                            <span>
                                <IconButton
                                    size="small"
                                    aria-label={`Timer for ${title}`}
                                    onClick={onToggle}
                                    disabled={timerDisabled}
                                    color={expanded ? 'primary' : 'default'}
                                    sx={{
                                        transition: 'color 180ms ease, transform 180ms ease',
                                        transform: expanded ? 'scale(1.04)' : 'scale(1)',
                                    }}
                                >
                                    <TimerIcon sx={{ fontSize: '1.1rem' }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                )}
            </Box>
            <Collapse
                in={active || expanded}
                timeout={{ enter: 320, exit: 220 }}
                easing={{ enter: 'cubic-bezier(0.22, 1, 0.36, 1)', exit: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                mountOnEnter
                unmountOnExit
            >
                <Box sx={{ px: 2, pb: 2, pt: 0.5, animation: `${panelReveal} 220ms ease-out` }}>
                    {children}
                </Box>
            </Collapse>
        </Box>
    );
}
