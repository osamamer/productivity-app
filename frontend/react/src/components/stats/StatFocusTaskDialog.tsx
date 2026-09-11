import { useEffect, useState } from 'react';
import {
    Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Stack, TextField,
} from '@mui/material';
import { StatDefinition } from '../../types/Stats';

type Props = {
    open: boolean;
    definition: StatDefinition | null;
    saving?: boolean;
    error?: string | null;
    onClose: () => void;
    onConfirm: (taskName: string) => void;
    onClear: () => void;
};

export function StatFocusTaskDialog({
    open,
    definition,
    saving = false,
    error = null,
    onClose,
    onConfirm,
    onClear,
}: Props) {
    const [taskName, setTaskName] = useState('');

    useEffect(() => {
        if (open) setTaskName(definition?.focusTaskName ?? definition?.name ?? '');
    }, [definition?.id, definition?.focusTaskName, definition?.name, open]);

    const trimmedTaskName = taskName.trim();
    const hasExistingLink = Boolean(definition?.focusTaskName);

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            sx={{
                '& .MuiDialog-container': {
                    justifyContent: 'flex-end',
                },
            }}
        >
            <DialogTitle>
                {hasExistingLink ? 'Change linked task' : 'Link existing task focus'}
                {definition ? ` for ${definition.name}` : ''}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <DialogContentText>
                        Include Pomodoro time from every task with this name in the statistic’s Focus time view.
                        Completed tasks are included, and capitalization does not matter.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        label="Task name"
                        value={taskName}
                        onChange={event => setTaskName(event.target.value)}
                        disabled={saving}
                        error={trimmedTaskName.length === 0}
                        helperText="The name is matched exactly after trimming spaces."
                        onKeyDown={event => {
                            if (event.key === 'Enter' && trimmedTaskName && !saving) {
                                event.preventDefault();
                                onConfirm(trimmedTaskName);
                            }
                        }}
                    />
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                {hasExistingLink && (
                    <Button color="error" onClick={onClear} disabled={saving} sx={{ mr: 'auto' }}>
                        Unlink
                    </Button>
                )}
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => onConfirm(trimmedTaskName)}
                    disabled={saving || !trimmedTaskName || !definition}
                >
                    {saving ? 'Saving…' : 'Link tasks'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
