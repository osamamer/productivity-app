import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, DialogActions, DialogContent, DialogTitle,
    MenuItem, Popover, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { MouseEvent } from 'react';
import {
    StatDefinition, StatRecurrenceDay, StatRecurrenceFrequency, StatRecurringTaskDraft,
} from '../../types/Stats';
import { defaultStatRecurringTaskDraft, STAT_RECURRENCE_DAYS } from './statRecurringTaskUtils';
import { AppTimeField } from '../input/AppPickerFields';

type PopupPosition = { top: number; left: number };

const FREQUENCIES: { value: StatRecurrenceFrequency; label: string }[] = [
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'CUSTOM', label: 'Custom days' },
];

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function priorityBucket(importance: number): number {
    if (importance > 7) return 9;
    if (importance > 4) return 6;
    return 3;
}

type OptionsProps = {
    value: StatRecurringTaskDraft;
    onChange: (value: StatRecurringTaskDraft) => void;
    disabled?: boolean;
    timeError?: string;
    showPriority?: boolean;
};

export function StatRecurringTaskOptions({
    value,
    onChange,
    disabled = false,
    timeError,
    showPriority = true,
}: OptionsProps) {
    const updateFrequency = (recurrenceFrequency: StatRecurrenceFrequency) => {
        onChange({ ...value, recurrenceFrequency });
    };

    const updateDays = (_event: MouseEvent<HTMLElement>, selectedDays: StatRecurrenceDay[]) => {
        onChange({ ...value, recurrenceDaysOfWeek: selectedDays });
    };

    return (
        <Stack spacing={1.5}>
            {showPriority && <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    Priority for all recurrences
                </Typography>
                <Stack direction="row" spacing={1}>
                    {PRIORITY_OPTIONS.map(option => {
                        const selected = priorityBucket(value.importance) === option.value;
                        return (
                            <Chip
                                key={option.label}
                                label={option.label}
                                onClick={() => onChange({ ...value, importance: option.value })}
                                disabled={disabled}
                                sx={{
                                    border: `1px solid ${option.color}`,
                                    color: selected ? '#fff' : option.color,
                                    backgroundColor: selected ? option.color : 'transparent',
                                    cursor: disabled ? 'default' : 'pointer',
                                    fontWeight: selected ? 600 : 400,
                                }}
                            />
                        );
                    })}
                </Stack>
            </Box>}
            <AppTimeField
                label="Task time"
                value={value.timeOfDay}
                onChange={timeOfDay => onChange({ ...value, timeOfDay })}
                disabled={disabled}
                error={Boolean(timeError)}
                helperText={timeError}
            />
            <TextField
                select
                fullWidth
                size="small"
                label="Repeat"
                value={value.recurrenceFrequency}
                onMouseDown={event => event.stopPropagation()}
                onClick={event => event.stopPropagation()}
                onChange={event => updateFrequency(event.target.value as StatRecurrenceFrequency)}
                disabled={disabled}
                SelectProps={{
                    MenuProps: {
                        onMouseDown: event => event.stopPropagation(),
                        onClick: event => event.stopPropagation(),
                    },
                }}
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
    anchorPosition?: PopupPosition | null;
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
    anchorPosition = null,
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
    const timeMissing = !/^\d{2}:\d{2}$/.test(draft.timeOfDay);

    return (
        <Popover
            open={open && Boolean(anchorPosition)}
            onClose={saving ? undefined : onClose}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? { top: 0, left: 0 }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
                paper: {
                    sx: {
                        width: { xs: 'calc(100vw - 24px)', sm: 380 },
                        maxHeight: 'calc(100vh - 24px)',
                        overflow: 'auto',
                    },
                },
            }}
        >
            <Box>
            <DialogTitle>
                {title}{definition ? ` for ${definition.name}` : ''}
            </DialogTitle>
            <DialogContent dividers>
                <StatRecurringTaskOptions
                    value={draft}
                    onChange={setDraft}
                    disabled={saving}
                    timeError={timeMissing ? 'Choose a task time.' : undefined}
                />
                {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => onConfirm(draft)}
                    disabled={saving || customDaysMissing || timeMissing || !definition}
                >
                    {saving ? 'Saving…' : confirmLabel}
                </Button>
            </DialogActions>
            </Box>
        </Popover>
    );
}
