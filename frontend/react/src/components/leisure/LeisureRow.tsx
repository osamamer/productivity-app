import { ReactNode, useState } from 'react';
import { Box, Collapse, IconButton, InputBase, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import TimerIcon from '@mui/icons-material/Timer';
import TuneIcon from '@mui/icons-material/Tune';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const ROW_BORDER_WIDTH = '2px';

const panelReveal = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

export type LeisurePanel = 'timer' | 'details';

interface LeisureRowProps {
    title: string;
    // The activity colour; null draws a neutral dot.
    color: string | null;
    // A timer runs for this row: drawn like a task with a running pomodoro.
    active?: boolean;
    paused?: boolean;
    // 0–100 for a countdown, null for an open timer.
    progress?: number | null;
    panel: LeisurePanel | null;
    onTogglePanel: (panel: LeisurePanel) => void;
    timerDisabled?: boolean;
    // Omitted for rows that are not an activity (a timer started without one): no rename, details or delete.
    onRename?: (name: string) => void;
    onDelete?: () => void;
    children: ReactNode;
}

function EditableName({ title, onRename }: { title: string; onRename?: (name: string) => void }) {
    const [draft, setDraft] = useState<string | null>(null);
    const finish = () => {
        const name = draft?.trim();
        if (name && name !== title) onRename?.(name);
        setDraft(null);
    };
    if (draft !== null) {
        return (
            <InputBase
                autoFocus
                fullWidth
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onBlur={finish}
                onKeyDown={event => {
                    if (event.key === 'Enter') finish();
                    if (event.key === 'Escape') setDraft(null);
                }}
                inputProps={{ 'aria-label': `Rename ${title}`, maxLength: 60 }}
                sx={{ fontSize: '1.05rem', lineHeight: 1.5, p: 0, '& input': { p: 0 } }}
            />
        );
    }
    return (
        <Typography
            onClick={onRename ? () => setDraft(title) : undefined}
            sx={{ fontSize: '1.05rem', lineHeight: 1.5, overflowWrap: 'anywhere', cursor: onRename ? 'text' : 'default', width: 'fit-content' }}
        >
            {title}
        </Typography>
    );
}

/** One activity on the leisure home, drawn like a Home task row: timer, details and delete on the right. */
export function LeisureRow({
    title, color, active = false, paused = false, progress = null, panel, onTogglePanel,
    timerDisabled = false, onRename, onDelete, children,
}: LeisureRowProps) {
    const theme = useTheme();
    const activeAccent = theme.palette.primary.main;
    const restColor = theme.palette.mode === 'dark' ? '#9BC5A3' : '#7EA88A';
    const borderColor = active ? (paused ? restColor : alpha(activeAccent, 0.7)) : 'transparent';
    const progressColor = paused ? restColor : activeAccent;
    const showProgress = active && progress !== null;
    const background = active ? alpha(activeAccent, 0.05) : 'transparent';
    const open = active || panel !== null;

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
                <Box sx={{ width: 38, height: 38, mr: 0.5, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color ?? 'text.disabled' }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <EditableName title={title} onRename={onRename} />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5 }}>
                    <Tooltip title={timerDisabled ? 'Stop the running timer first' : 'Timer'}>
                        <span>
                            <IconButton
                                size="small"
                                aria-label={`Timer for ${title}`}
                                onClick={() => { if (!active) onTogglePanel('timer'); }}
                                disabled={timerDisabled}
                                color={panel === 'timer' || active ? 'primary' : 'default'}
                                sx={{
                                    transition: 'color 180ms ease, transform 180ms ease',
                                    transform: panel === 'timer' ? 'scale(1.04)' : 'scale(1)',
                                }}
                            >
                                <TimerIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    {onRename && (
                        <Tooltip title="Details">
                            <IconButton
                                size="small"
                                aria-label={`Details for ${title}`}
                                onClick={() => onTogglePanel('details')}
                                color={panel === 'details' ? 'primary' : 'default'}
                            >
                                <TuneIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {onDelete && (
                        <Tooltip title="Delete activity">
                            <IconButton size="small" color="error" aria-label={`Delete activity ${title}`} onClick={onDelete}>
                                <DeleteOutlineIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>
            <Collapse
                in={open}
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
