import { useState } from 'react';
import { Box, Button, IconButton, Popover, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import { Task } from '../../types/Task';

type SubtaskBulkActionsProps = {
    selected: Task[];
    onSetCompleted: (completed: boolean) => Promise<void>;
    onRename: (name: string) => Promise<void>;
    onDelete: () => Promise<void>;
    canDelete?: boolean;
    onClear: () => void;
};

const actionSx = { textTransform: 'none', minWidth: 0, px: 1, py: 0.25, fontSize: 13 } as const;

export function SubtaskBulkActions({ selected, onSetCompleted, onRename, onDelete, canDelete = true, onClear }: SubtaskBulkActionsProps) {
    const [busy, setBusy] = useState(false);
    const [renameAnchor, setRenameAnchor] = useState<HTMLElement | null>(null);
    const [deleteAnchor, setDeleteAnchor] = useState<HTMLElement | null>(null);
    const [name, setName] = useState('');
    if (selected.length < 2) return null;

    const allCompleted = selected.every(item => item.completed);
    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box onClick={event => event.stopPropagation()} sx={{
            display: 'flex', alignItems: 'center', gap: 0.25, mb: 0.5, pl: 1.25, pr: 0.25, py: 0.25,
            borderRadius: 2, border: 1,
            borderColor: theme => alpha(theme.palette.primary.main, 0.35),
            bgcolor: theme => alpha(theme.palette.primary.main, 0.06),
        }}>
            <Typography variant="body2" sx={{ mr: 'auto', fontWeight: 600, color: 'primary.main' }}>{selected.length} selected</Typography>
            <Button size="small" disabled={busy} sx={actionSx}
                startIcon={allCompleted ? <ReplayIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
                onClick={() => void run(() => onSetCompleted(!allCompleted))}>
                {allCompleted ? 'Reopen' : 'Complete'}
            </Button>
            <Button size="small" disabled={busy} sx={actionSx} startIcon={<DriveFileRenameOutlineIcon fontSize="small" />}
                onClick={event => { setName(''); setRenameAnchor(event.currentTarget); }}>
                Rename
            </Button>
            {canDelete && <Button size="small" color="error" disabled={busy} sx={actionSx} startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={event => setDeleteAnchor(event.currentTarget)}>
                Delete
            </Button>}
            <IconButton size="small" aria-label="Clear selection" title="Clear selection" onClick={onClear} sx={{ ml: 0.25 }}>
                <CloseIcon fontSize="small" />
            </IconButton>
            <Popover open={renameAnchor !== null} anchorEl={renameAnchor} onClose={() => setRenameAnchor(null)}>
                <Box component="form" onSubmit={event => {
                    event.preventDefault();
                    if (!name.trim()) return;
                    setRenameAnchor(null);
                    void run(() => onRename(name.trim()));
                }} sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField autoFocus size="small" label="Name for selected subtasks" value={name} onChange={event => setName(event.target.value)} />
                    <Button type="submit" disabled={!name.trim()}>Save</Button>
                </Box>
            </Popover>
            <Popover open={deleteAnchor !== null} anchorEl={deleteAnchor} onClose={() => setDeleteAnchor(null)}>
                <Box sx={{ p: 1.5 }}>
                    <Typography variant="body2">Delete {selected.length} selected subtasks?</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                        <Button size="small" onClick={() => setDeleteAnchor(null)}>Cancel</Button>
                        <Button size="small" color="error" onClick={() => { setDeleteAnchor(null); void run(onDelete); }}>Delete</Button>
                    </Box>
                </Box>
            </Popover>
        </Box>
    );
}
