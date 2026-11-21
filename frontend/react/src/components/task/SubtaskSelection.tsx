import { useState } from 'react';
import { Box, Button, IconButton, Popover, TextField, Typography } from '@mui/material';
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
};

export function SubtaskBulkActions({ selected, onSetCompleted, onRename, onDelete, canDelete = true }: SubtaskBulkActionsProps) {
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
        <Box onClick={event => event.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.25, borderRadius: 2, bgcolor: 'action.selected' }}>
            <Typography variant="caption" sx={{ mr: 'auto', px: 0.5 }}>{selected.length} selected</Typography>
            <IconButton size="small" disabled={busy} aria-label={allCompleted ? 'Reopen selected subtasks' : 'Complete selected subtasks'}
                title={allCompleted ? 'Reopen selected subtasks' : 'Complete selected subtasks'}
                onClick={() => void run(() => onSetCompleted(!allCompleted))}>
                {allCompleted ? <ReplayIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" disabled={busy} aria-label="Rename selected subtasks" title="Rename selected subtasks"
                onClick={event => { setName(''); setRenameAnchor(event.currentTarget); }}>
                <DriveFileRenameOutlineIcon fontSize="small" />
            </IconButton>
            {canDelete && <IconButton size="small" color="error" disabled={busy} aria-label="Delete selected subtasks" title="Delete selected subtasks"
                onClick={event => setDeleteAnchor(event.currentTarget)}>
                <DeleteOutlineIcon fontSize="small" />
            </IconButton>}
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
