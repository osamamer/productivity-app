import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Popover, TextField, Typography } from '@mui/material';

type TaskParentPopoverProps = {
    anchorEl: HTMLElement | null;
    selectedCount: number;
    submitting: boolean;
    onClose: () => void;
    onSubmit: (name: string) => Promise<void>;
};

export function TaskParentPopover({
    anchorEl,
    selectedCount,
    submitting,
    onClose,
    onSubmit,
}: TaskParentPopoverProps) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (!anchorEl) setName('');
    }, [anchorEl]);

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || submitting) return;
        void onSubmit(trimmedName).catch(() => undefined);
    };

    return (
        <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => {
                if (!submitting) onClose();
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{ paper: { sx: { p: 1.5, width: 300, maxWidth: 'calc(100vw - 24px)' } } }}
        >
            <Box component="form" onSubmit={submit} onClick={event => event.stopPropagation()}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    Make {selectedCount} selected {selectedCount === 1 ? 'task' : 'tasks'} subtasks of a new task
                </Typography>
                <TextField
                    autoFocus
                    autoComplete="off"
                    fullWidth
                    size="small"
                    label="Parent task name"
                    placeholder="Plan the project"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    inputProps={{ maxLength: 255, 'aria-label': 'New parent task name' }}
                    disabled={submitting}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 0.75 }}>
                    <Button size="small" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        size="small"
                        type="submit"
                        variant="contained"
                        disabled={submitting || !name.trim()}
                    >
                        {submitting ? <CircularProgress size={16} color="inherit" /> : 'Create'}
                    </Button>
                </Box>
            </Box>
        </Popover>
    );
}
