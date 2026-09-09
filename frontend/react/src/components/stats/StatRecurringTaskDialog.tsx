import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { MouseEvent } from 'react';
import {
    StatDefinition, StatRecurrenceDay, StatRecurrenceFrequency, StatRecurringTaskDraft,
} from '../../types/Stats';
import { defaultStatRecurringTaskDraft, STAT_RECURRENCE_DAYS } from './statRecurringTaskUtils';

const FREQUENCIES: { value: StatRecurrenceFrequency; label: string }[] = [
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'CUSTOM', label: 'Custom days' },
];

type OptionsProps = {
    value: StatRecurringTaskDraft;
    onChange: (value: StatRecurringTaskDraft) => void;
    disabled?: boolean;
};

export function StatRecurringTaskOptions({ value, onChange, disabled = false }: OptionsProps) {
    const updateFrequency = (recurrenceFrequency: StatRecurrenceFrequency) => {
        onChange({ ...value, recurrenceFrequency });
    };

    const updateDays = (_event: MouseEvent<HTMLElement>, selectedDays: StatRecurrenceDay[]) => {
        onChange({ ...value, recurrenceDaysOfWeek: selectedDays });
    };

    return (
        <Stack spacing={1.5}>
            <TextField
                select
                fullWidth
                size="small"
                label="Repeat"
                value={value.recurrenceFrequency}
                onChange={event => updateFrequency(event.target.value as StatRecurrenceFrequency)}
                disabled={disabled}
            >
                {FREQUENCIES.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>
            {value.recurrenceFrequency === 'CUSTOM' && (
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                        Appears on
                    </Typography>
                    <ToggleButtonGroup
                        value={value.recurrenceDaysOfWeek}
                        onChange={updateDays}
                        aria-label="Days of week"
                        disabled={disabled}
                        fullWidth
                        size="small"
                    >
                        {STAT_RECURRENCE_DAYS.map(day => (
                            <ToggleButton key={day.value} value={day.value} aria-label={day.value}>
                                {day.label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        Choose one or more days.
                    </Typography>
                </Box>
            )}
        </Stack>
    );
}

type DialogProps = {
    open: boolean;
    definition: StatDefinition | null;
    saving?: boolean;
    error?: string | null;
    initialDraft?: StatRecurringTaskDraft | null;
    title?: string;
    confirmLabel?: string;
    onClose: () => void;
    onConfirm: (draft: StatRecurringTaskDraft) => void;
};

export function StatRecurringTaskDialog({
    open,
    definition,
    saving = false,
    error = null,
    initialDraft = null,
    title = 'Create recurring task',
    confirmLabel = 'Create task',
    onClose,
    onConfirm,
}: DialogProps) {
    const [draft, setDraft] = useState<StatRecurringTaskDraft>(defaultStatRecurringTaskDraft);

    useEffect(() => {
        if (open) setDraft(initialDraft ?? defaultStatRecurringTaskDraft());
    }, [open, definition?.id, initialDraft]);

    const customDaysMissing = draft.recurrenceFrequency === 'CUSTOM'
        && draft.recurrenceDaysOfWeek.length === 0;

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle>
                {title}{definition ? ` for ${definition.name}` : ''}
            </DialogTitle>
            <DialogContent dividers>
                <StatRecurringTaskOptions value={draft} onChange={setDraft} disabled={saving} />
                {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => onConfirm(draft)}
                    disabled={saving || customDaysMissing || !definition}
                >
                    {saving ? 'Saving…' : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
