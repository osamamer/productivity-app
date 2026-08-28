import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { AttentionState, MentalThread, MentalThreadInput } from '../../types/MentalThread.ts';
import { attentionStateDetails, attentionStates } from './mentalThreadPresentation.ts';

interface MentalThreadFormDialogProps {
    open: boolean;
    thread: MentalThread | null;
    onClose: () => void;
    onSave: (input: MentalThreadInput) => Promise<boolean>;
}

const emptyInput: MentalThreadInput = {
    title: '',
    description: null,
    attentionState: 'RUMINATING',
    desiredResolution: null,
    targetCloseDate: null,
    hardDeadlineDate: null,
    nextReviewDate: null,
    currentMentalLoad: 5,
    loadReason: null,
};

function inputFromThread(thread: MentalThread | null): MentalThreadInput {
    if (!thread) return emptyInput;
    return {
        title: thread.title,
        description: thread.description,
        attentionState: thread.attentionState,
        desiredResolution: thread.desiredResolution,
        targetCloseDate: thread.targetCloseDate,
        hardDeadlineDate: thread.hardDeadlineDate,
        nextReviewDate: thread.nextReviewDate,
        currentMentalLoad: thread.currentMentalLoad,
        loadReason: null,
    };
}

export function MentalThreadFormDialog({ open, thread, onClose, onSave }: MentalThreadFormDialogProps) {
    const [input, setInput] = useState<MentalThreadInput>(emptyInput);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setInput(inputFromThread(thread));
    }, [open, thread]);

    const update = <K extends keyof MentalThreadInput>(key: K, value: MentalThreadInput[K]) => {
        setInput(current => ({ ...current, [key]: value }));
    };

    const handleSave = async () => {
        if (!input.title.trim()) return;
        setSaving(true);
        try {
            const saved = await onSave({
                ...input,
                title: input.title.trim(),
                description: input.description?.trim() || null,
                desiredResolution: input.desiredResolution?.trim() || null,
                loadReason: input.loadReason?.trim() || null,
            });
            if (saved) onClose();
        } finally {
            setSaving(false);
        }
    };

    const stateDetails = attentionStateDetails[input.attentionState];

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
            <DialogTitle>{thread ? 'Edit mental thread' : 'Capture a mental thread'}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2.5} sx={{ pt: 0.5 }}>
                    <TextField
                        label="What is occupying your mind?"
                        value={input.title}
                        onChange={event => update('title', event.target.value)}
                        required
                        autoFocus
                        inputProps={{ maxLength: 160 }}
                    />
                    <TextField
                        label="Context"
                        value={input.description ?? ''}
                        onChange={event => update('description', event.target.value || null)}
                        multiline
                        minRows={2}
                        inputProps={{ maxLength: 5000 }}
                        helperText="Enough context to understand why this is still open."
                    />
                    <TextField
                        label="What would make this feel complete?"
                        value={input.desiredResolution ?? ''}
                        onChange={event => update('desiredResolution', event.target.value || null)}
                        multiline
                        minRows={2}
                        inputProps={{ maxLength: 5000 }}
                    />

                    <FormControl>
                        <InputLabel id="attention-state-label">Attention state</InputLabel>
                        <Select
                            labelId="attention-state-label"
                            label="Attention state"
                            value={input.attentionState}
                            onChange={event => update('attentionState', event.target.value as AttentionState)}
                        >
                            {attentionStates.map(state => (
                                <MenuItem key={state} value={state}>
                                    {attentionStateDetails[state].label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>{stateDetails.description}</FormHelperText>
                    </FormControl>

                    <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                            <Typography variant="subtitle2">Mental load</Typography>
                            <Typography variant="h6" color="primary.main">
                                {input.currentMentalLoad}/10
                            </Typography>
                        </Stack>
                        <Slider
                            value={input.currentMentalLoad}
                            onChange={(_, value) => update('currentMentalLoad', value as number)}
                            min={1}
                            max={10}
                            step={1}
                            marks
                            valueLabelDisplay="auto"
                            aria-label="Mental load"
                        />
                        <TextField
                            label={thread && thread.currentMentalLoad !== input.currentMentalLoad
                                ? 'What changed the load?'
                                : 'What is contributing to the load?'}
                            value={input.loadReason ?? ''}
                            onChange={event => update('loadReason', event.target.value || null)}
                            fullWidth
                            size="small"
                            inputProps={{ maxLength: 500 }}
                            helperText="Optional — this is saved with the load history."
                        />
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                        <TextField
                            label="Target close"
                            type="date"
                            value={input.targetCloseDate ?? ''}
                            onChange={event => update('targetCloseDate', event.target.value || null)}
                            InputLabelProps={{ shrink: true }}
                            helperText="When you hope it is settled"
                        />
                        <TextField
                            label="Hard deadline"
                            type="date"
                            value={input.hardDeadlineDate ?? ''}
                            onChange={event => update('hardDeadlineDate', event.target.value || null)}
                            InputLabelProps={{ shrink: true }}
                            helperText="An external consequence"
                        />
                        <TextField
                            label="Review again"
                            type="date"
                            value={input.nextReviewDate ?? ''}
                            onChange={event => update('nextReviewDate', event.target.value || null)}
                            InputLabelProps={{ shrink: true }}
                            helperText="Permission to set it down"
                        />
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={saving || !input.title.trim()}
                >
                    {saving ? 'Saving…' : thread ? 'Save changes' : 'Create thread'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
