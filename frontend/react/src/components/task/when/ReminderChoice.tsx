import { useState } from 'react';
import { Box, Chip, MenuItem, TextField } from '@mui/material';
import { AppNumberField } from '../../input/AppNumberField';
import { REMINDER_PRESETS } from './whenModel';

const UNITS = [
    { value: 1, label: 'minutes before' },
    { value: 60, label: 'hours before' },
    { value: 1440, label: 'days before' },
] as const;

const MAX_REMINDER_MINUTES = 8 * 7 * 1440;

function customParts(minutes: number): { amount: number; unit: number } {
    const unit = minutes % 1440 === 0 ? 1440 : minutes % 60 === 0 ? 60 : 1;
    return { amount: minutes / unit, unit };
}

/** None, a few presets, or a custom amount before the scheduled time. */
export function ReminderChoice({ value, disabled = false, onChange }: {
    value: number | null;
    disabled?: boolean;
    onChange: (minutes: number | null) => void;
}) {
    const isPreset = value === null || REMINDER_PRESETS.some(preset => preset.minutes === value);
    const [customOpen, setCustomOpen] = useState(!isPreset);
    const parts = customParts(value && !isPreset ? value : 30);
    const setCustom = (amount: number, unit: number) => {
        onChange(Math.min(MAX_REMINDER_MINUTES, Math.max(1, Math.round(amount)) * unit));
    };
    const chip = (label: string, selected: boolean, onClick: () => void) => (
        <Chip
            key={label}
            label={label}
            size="small"
            disabled={disabled}
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            onClick={onClick}
        />
    );

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {chip('None', value === null && !customOpen, () => { setCustomOpen(false); onChange(null); })}
                {REMINDER_PRESETS.map(preset => chip(preset.label, value === preset.minutes && !customOpen, () => {
                    setCustomOpen(false);
                    onChange(preset.minutes);
                }))}
                {chip('Custom', customOpen, () => {
                    setCustomOpen(true);
                    setCustom(parts.amount, parts.unit);
                })}
            </Box>
            {customOpen && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
                    <AppNumberField
                        value={parts.amount}
                        min={1}
                        size="small"
                        sx={{ width: 96 }}
                        inputProps={{ 'aria-label': 'Reminder amount' }}
                        onChange={event => setCustom(Number(event.target.value) || 1, parts.unit)}
                        onStepValueChange={amount => setCustom(amount, parts.unit)}
                    />
                    <TextField
                        select
                        size="small"
                        value={parts.unit}
                        onChange={event => setCustom(parts.amount, Number(event.target.value))}
                        inputProps={{ 'aria-label': 'Reminder unit' }}
                    >
                        {UNITS.map(unit => <MenuItem key={unit.value} value={unit.value}>{unit.label}</MenuItem>)}
                    </TextField>
                </Box>
            )}
        </Box>
    );
}
