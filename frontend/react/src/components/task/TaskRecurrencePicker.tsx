import { Box, Collapse, MenuItem, Stack, TextField } from '@mui/material';
import { AppDateField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';
import {
    TaskRecurrenceDraft,
    TaskRecurrenceFrequency,
    TaskRecurrenceUnit,
} from '../../types/TaskRecurrence';

type Props = {
    value: TaskRecurrenceDraft;
    onChange: (value: TaskRecurrenceDraft) => void;
    disabled?: boolean;
    showEndDate?: boolean;
    showCustomOptions?: boolean;
};

const FREQUENCY_OPTIONS: { value: TaskRecurrenceFrequency; label: string }[] = [
    { value: 'NONE', label: 'Never' },
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'CUSTOM', label: 'Custom' },
];

const UNIT_OPTIONS: { value: TaskRecurrenceUnit; label: string }[] = [
    { value: 'DAYS', label: 'days' },
    { value: 'WEEKS', label: 'weeks' },
    { value: 'MONTHS', label: 'months' },
];

type CustomOptionsProps = {
    value: TaskRecurrenceDraft;
    onChange: (value: TaskRecurrenceDraft) => void;
    disabled?: boolean;
};

export function TaskRecurrenceCustomOptions({ value, onChange, disabled = false }: CustomOptionsProps) {
    const update = (changes: Partial<TaskRecurrenceDraft>) => onChange({ ...value, ...changes });

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 1.25 }}>
            <AppNumberField
                label="Every"
                value={value.recurrenceInterval ?? 1}
                min={1}
                max={999}
                onChange={event => update({ recurrenceInterval: Number(event.target.value) || 1 })}
                onStepValueChange={recurrenceInterval => update({ recurrenceInterval })}
                size="small"
            />
            <TextField
                select
                label="Unit"
                value={value.recurrenceUnit ?? 'WEEKS'}
                disabled={disabled}
                onChange={event => update({ recurrenceUnit: event.target.value as TaskRecurrenceUnit })}
                size="small"
            >
                {UNIT_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>
        </Box>
    );
}

export function TaskRecurrencePicker({
    value,
    onChange,
    disabled = false,
    showEndDate = true,
    showCustomOptions = true,
}: Props) {
    const update = (changes: Partial<TaskRecurrenceDraft>) => {
        const next = { ...value, ...changes };
        if (next.recurrenceFrequency === 'NONE') {
            next.recurrenceEndDate = null;
            next.recurrenceInterval = null;
            next.recurrenceUnit = null;
        } else if (next.recurrenceFrequency === 'CUSTOM') {
            next.recurrenceInterval ??= 1;
            next.recurrenceUnit ??= 'WEEKS';
        } else {
            next.recurrenceInterval = null;
            next.recurrenceUnit = null;
        }
        onChange(next);
    };

    return (
        <Stack spacing={1.25}>
            <TextField
                select
                label="Repeat"
                value={value.recurrenceFrequency}
                disabled={disabled}
                onChange={event => update({
                    recurrenceFrequency: event.target.value as TaskRecurrenceFrequency,
                })}
                size="small"
                fullWidth
            >
                {FREQUENCY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>

            {showCustomOptions && value.recurrenceFrequency === 'CUSTOM' && (
                <TaskRecurrenceCustomOptions value={value} onChange={onChange} disabled={disabled} />
            )}

            {showEndDate && (
                <Collapse in={value.recurrenceFrequency !== 'NONE'} timeout={180} unmountOnExit>
                    <AppDateField
                        label="Repeat until (optional)"
                        value={value.recurrenceEndDate ?? ''}
                        onChange={recurrenceEndDate => update({ recurrenceEndDate: recurrenceEndDate || null })}
                        disabled={disabled}
                    />
                </Collapse>
            )}
        </Stack>
    );
}
