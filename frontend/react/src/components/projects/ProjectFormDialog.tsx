import { useEffect, useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
} from '@mui/material';
import { Project, ProjectInput } from '../../types/Project';

interface ProjectFormDialogProps {
    open: boolean;
    project: Project | null;
    onClose: () => void;
    onSave: (input: ProjectInput) => Promise<boolean>;
}

export function ProjectFormDialog({ open, project, onClose, onSave }: ProjectFormDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(project?.name ?? '');
        setDescription(project?.description ?? '');
    }, [open, project]);

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        setSaving(true);
        try {
            const saved = await onSave({
                name: trimmedName,
                description: description.trim() || null,
            });
            if (saved) onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2.5} sx={{ pt: 0.5 }}>
                    <TextField
                        label="Name"
                        autoComplete="off"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        required
                        autoFocus
                        inputProps={{ maxLength: 120 }}
                    />
                    <TextField
                        label="Description"
                        autoComplete="off"
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        multiline
                        minRows={2}
                        inputProps={{ maxLength: 2000 }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={saving || !name.trim()}
                >
                    {saving ? 'Saving…' : project ? 'Save' : 'Create project'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
