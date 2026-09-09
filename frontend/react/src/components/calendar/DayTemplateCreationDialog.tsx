import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Fade, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { CalendarEvent } from '../../types/CalendarEvent';
import { DayTemplateRequest } from '../../types/DayTemplate';
import { Task } from '../../types/Task';
import { AppDateField } from '../input/AppPickerFields';
import { buildDayTemplateRequest, formatTemplateDate } from './dayTemplateUtils';

type Props = {
    open: boolean;
    initialDate: string;
    events: CalendarEvent[];
    tasks: Task[];
    onSave: (request: DayTemplateRequest) => Promise<void>;
    onClose: () => void;
};

export function DayTemplateCreationDialog({ open, initialDate, events, tasks, onSave, onClose }: Props) {
    const [name, setName] = useState('');
    const [sourceDate, setSourceDate] = useState(initialDate);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open) return;
        setName('');
        setSourceDate(initialDate);
        setError(null);
    }, [initialDate, open]);

    const preview = useMemo(
        () => buildDayTemplateRequest(name, sourceDate, events, tasks),
        [events, name, sourceDate, tasks],
    );

    const close = () => {
        if (saving) return;
        onClose();
    };

    const save = async () => {
        if (!name.trim()) {
            setError('Give the template a name.');
            return;
        }
        if (!sourceDate) {
            setError('Choose the day to copy.');
            return;
        }
        if (preview.events.length === 0 && preview.tasks.length === 0) {
            setError('The selected day must contain at least one event or task.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await onSave(preview);
            setName('');
            onClose();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save the day template.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            TransitionComponent={Fade}
            transitionDuration={{ enter: 180, exit: 140 }}
            fullWidth
            maxWidth="xs"
        >
            <DialogTitle>Save day as template</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Give this schedule a name, then choose the day whose events and tasks should be reused.
                    </Typography>
                    <TextField
                        label="Template name"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        placeholder="e.g. Focus day"
                        slotProps={{ htmlInput: { maxLength: 120 } }}
                        fullWidth
                        autoFocus
                    />
                    <AppDateField label="Copy this day" value={sourceDate} onChange={setSourceDate} />
                    {sourceDate && (
                        <Typography variant="caption" color="text.secondary">
                            {formatTemplateDate(sourceDate)} contains {preview.events.length} event{preview.events.length === 1 ? '' : 's'} and {preview.tasks.length} task{preview.tasks.length === 1 ? '' : 's'}.
                        </Typography>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={close} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={() => void save()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save template'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
