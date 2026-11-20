import { ReactNode, useState } from 'react';
import { Box, Collapse, IconButton, InputBase, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import TimerIcon from '@mui/icons-material/Timer';
import TuneIcon from '@mui/icons-material/Tune';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const panelReveal = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

export type LeisurePanel = 'timer' | 'details';

interface LeisureRowProps {
    title: string;
    // Time today for this activity, shown under the name once there is some.
    subtitle?: string | null;
    // A timer runs for this row; the timer panel below shows its clock and state.
    active?: boolean;
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

/** One activity on the leisure home: its name and time today, with timer, details and delete on the right. */
export function LeisureRow({
    title, subtitle = null, active = false, panel, onTogglePanel, timerDisabled = false, onRename, onDelete, children,
}: LeisureRowProps) {
    const theme = useTheme();
    const activeAccent = theme.palette.primary.main;
    const open = active || panel !== null;

    return (
        <Box
            sx={{
                borderRadius: 1.5,
                backgroundColor: active ? alpha(activeAccent, 0.05) : 'transparent',
                boxShadow: active ? `inset 3px 0 0 ${alpha(activeAccent, 0.7)}` : 'none',
                overflow: 'hidden',
                mb: 0.25,
                transition: 'background-color 0.32s ease, box-shadow 0.32s ease',
                '&:hover': { backgroundColor: active ? alpha(activeAccent, 0.05) : alpha(activeAccent, 0.04) },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <EditableName title={title} onRename={onRename} />
                    {subtitle && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                            {subtitle}
                        </Typography>
                    )}
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
