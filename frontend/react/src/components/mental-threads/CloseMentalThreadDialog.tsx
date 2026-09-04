import { useEffect, useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from '@mui/material';
import { CloseMentalThreadInput, ClosureType, MentalThread } from '../../types/MentalThread.ts';
import { closureTypeLabels } from './mentalThreadPresentation.ts';

interface CloseMentalThreadDialogProps {
    thread: MentalThread | null;
    onClose: () => void;
    onConfirm: (input: CloseMentalThreadInput) => Promise<boolean>;
}

export function CloseMentalThreadDialog({ thread, onClose, onConfirm }: CloseMentalThreadDialogProps) {
    const [closureType, setClosureType] = useState<ClosureType>('RESOLVED');
    const [resolutionSummary, setResolutionSummary] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (thread) {
            setClosureType('RESOLVED');
            setResolutionSummary('');
        }
    }, [thread]);

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const closed = await onConfirm({
                closureType,
                resolutionSummary: resolutionSummary.trim() || null,
            });
            if (closed) onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={Boolean(thread)} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>Close “{thread?.title}”</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                    <FormControl>
                        <InputLabel id="closure-type-label">How did it close?</InputLabel>
                        <Select
                            labelId="closure-type-label"
                            value={closureType}
                            label="How did it close?"
                            onChange={event => setClosureType(event.target.value as ClosureType)}
                        >
                            {(Object.keys(closureTypeLabels) as ClosureType[]).map(type => (
                                <MenuItem key={type} value={type}>{closureTypeLabels[type]}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="What changed, or what are you choosing? (optional)"
                        autoComplete="off"
                        value={resolutionSummary}
                        onChange={event => setResolutionSummary(event.target.value)}
                        multiline
                        minRows={3}
                        inputProps={{ maxLength: 5000 }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => void handleConfirm()}
                    disabled={saving}
                >
                    {saving ? 'Closing…' : 'Close thread'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
