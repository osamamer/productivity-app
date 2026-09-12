import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, ClickAwayListener, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Popover, Stack, TextField,
} from '@mui/material';
import { StatDefinition } from '../../types/Stats';

type PopupPosition = { top: number; left: number };

type Props = {
    open: boolean;
    definition: StatDefinition | null;
    linkedTaskNames: string[];
    saving?: boolean;
    error?: string | null;
    anchorPosition?: PopupPosition | null;
    onClose: () => void;
    onAdd: (taskName: string) => void;
    onRemove: (taskName: string) => void;
};

export function StatFocusTaskDialog({
    open,
    definition,
    linkedTaskNames,
    saving = false,
    error = null,
    anchorPosition = null,
    onClose,
    onAdd,
    onRemove,
}: Props) {
    const [taskName, setTaskName] = useState('');

    useEffect(() => {
        if (open) setTaskName('');
    }, [definition?.id, open]);

    const trimmedTaskName = taskName.trim();
    const addTask = () => {
        if (!trimmedTaskName || saving) return;
        onAdd(trimmedTaskName);
        setTaskName('');
    };

    return (
        <Popover
            open={open && Boolean(anchorPosition)}
            onClose={saving ? undefined : onClose}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? { top: 0, left: 0 }}
            hideBackdrop
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
                paper: {
                    sx: {
                        width: { xs: 'calc(100vw - 24px)', sm: 430 },
                        maxHeight: 'calc(100vh - 24px)',
                        overflow: 'auto',
                    },
                },
            }}
        >
            <ClickAwayListener onClickAway={() => { if (!saving) onClose(); }}>
                <Box>
            <DialogTitle>
                Link existing tasks{definition ? ` for ${definition.name}` : ''}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <DialogContentText>
                        Add one or more task names. Pomodoro time from matching tasks is included in this statistic.
                    </DialogContentText>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                            autoFocus
                            fullWidth
                            size="small"
                            label="Task name"
                            value={taskName}
                            onChange={event => setTaskName(event.target.value)}
                            disabled={saving}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addTask();
                                }
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={addTask}
                            disabled={saving || !trimmedTaskName}
                            sx={{ minHeight: 40, flexShrink: 0 }}
                        >
                            Add
                        </Button>
                    </Stack>
                    {linkedTaskNames.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {linkedTaskNames.map(name => (
                                <Chip
                                    key={name.toLocaleLowerCase()}
                                    label={name}
                                    onDelete={() => onRemove(name)}
                                    disabled={saving}
                                />
                            ))}
                        </Box>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Done</Button>
            </DialogActions>
                </Box>
            </ClickAwayListener>
        </Popover>
    );
}
