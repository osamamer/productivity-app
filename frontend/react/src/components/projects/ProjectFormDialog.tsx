import { CompactPopover } from '../CompactPopover';
import { useEffect, useState } from 'react';
import {
    Box, Button, DialogActions, DialogContent, DialogTitle,
    Stack, TextField, ToggleButton, Typography,
} from '@mui/material';
import { Project, ProjectColor, ProjectIcon, ProjectInput } from '../../types/Project';
import {
    PROJECT_COLOR_OPTIONS,
    PROJECT_ICON_OPTIONS,
    ProjectIconGlyph,
    projectAccent,
} from './projectAppearance';

interface ProjectFormDialogProps {
    open: boolean;
    project: Project | null;
    onClose: () => void;
    onSave: (input: ProjectInput) => Promise<boolean>;
}

export function ProjectFormDialog({ open, project, onClose, onSave }: ProjectFormDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState<ProjectColor>('blue');
    const [icon, setIcon] = useState<ProjectIcon>('folder');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(project?.name ?? '');
        setDescription(project?.description ?? '');
        setColor(project?.color ?? 'blue');
        setIcon(project?.icon ?? 'folder');
    }, [open, project]);

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        setSaving(true);
        try {
            const saved = await onSave({
                name: trimmedName,
                description: description.trim() || null,
                color,
                icon,
            });
            if (saved) onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <CompactPopover open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
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
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Project color</Typography>
                        <Box role="group" aria-label="Project color" sx={{ display: 'flex', gap: 0.75 }}>
                            {PROJECT_COLOR_OPTIONS.map(option => (
                                <ToggleButton
                                    key={option.value}
                                    value={option.value}
                                    selected={color === option.value}
                                    aria-pressed={color === option.value}
                                    title={option.label}
                                    aria-label={option.label}
                                    onClick={() => setColor(option.value)}
                                    sx={{ width: 38, height: 38, p: 1 }}
                                >
                                    <Box
                                        component="span"
                                        sx={theme => ({
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            bgcolor: projectAccent(theme, option.value),
                                            boxShadow: color === option.value
                                                ? `0 0 0 3px ${theme.palette.background.paper}, 0 0 0 5px ${projectAccent(theme, option.value)}`
                                                : 'none',
                                        })}
                                    />
                                </ToggleButton>
                            ))}
                        </Box>
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Project icon</Typography>
                        <Box role="group" aria-label="Project icon" sx={{ display: 'flex', gap: 0.75 }}>
                            {PROJECT_ICON_OPTIONS.map(option => (
                                <ToggleButton
                                    key={option.value}
                                    value={option.value}
                                    selected={icon === option.value}
                                    aria-pressed={icon === option.value}
                                    title={option.label}
                                    aria-label={option.label}
                                    onClick={() => setIcon(option.value)}
                                    sx={{ width: 42, height: 38 }}
                                >
                                    <ProjectIconGlyph icon={option.value} />
                                </ToggleButton>
                            ))}
                        </Box>
                    </Box>
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
        </CompactPopover>
    );
}
