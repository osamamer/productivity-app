import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { NoteCategory } from '../../types/Note.ts';

const CATEGORY_COLORS = ['#8B7CF6', '#2BAE9B', '#E5A83B', '#E56B6F', '#4D91E3', '#D66BC1', '#7D9B48'];

interface CategoryDialogProps {
    open: boolean;
    category: NoteCategory | null;
    onClose: () => void;
    onSave: (name: string, color: string) => Promise<boolean>;
}

export function CategoryDialog({ open, category, onClose, onSave }: CategoryDialogProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(CATEGORY_COLORS[0]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(category?.name ?? '');
        setColor(category?.color ?? CATEGORY_COLORS[0]);
        setSaveError(false);
    }, [category, open]);

    async function handleSave() {
        if (!name.trim()) return;
        setSaving(true);
        setSaveError(false);
        const saved = await onSave(name.trim(), color);
        setSaving(false);
        if (saved) {
            onClose();
        } else {
            setSaveError(true);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    autoComplete="off"
                    fullWidth
                    label="Name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter') void handleSave();
                    }}
                    margin="dense"
                />
                {saveError && <Alert severity="error" sx={{ mt: 1.5 }}>Could not save this category.</Alert>}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>
                    Color
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {CATEGORY_COLORS.map(option => (
                        <Box
                            component="button"
                            type="button"
                            key={option}
                            onClick={() => setColor(option)}
                            aria-label={`Use color ${option}`}
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                border: color === option ? '3px solid' : '3px solid transparent',
                                borderColor: color === option ? 'text.primary' : 'transparent',
                                outline: `3px solid ${option}`,
                                outlineOffset: -5,
                                backgroundColor: option,
                                cursor: 'pointer',
                            }}
                        />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={() => void handleSave()} disabled={!name.trim() || saving}>
                    {saving ? <CircularProgress size={18} color="inherit" /> : category ? 'Save' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
