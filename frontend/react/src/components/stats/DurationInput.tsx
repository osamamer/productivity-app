import React, { useEffect, useRef, useState } from 'react';
import { Stack, TextField, Typography } from '@mui/material';

interface Props {
    value: number | null;
    onChange: (value: number | null) => void;
    autoFocus?: boolean;
    onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

function durationParts(value: number | null): { hours: string; minutes: string } {
    if (value == null || !Number.isFinite(value) || value < 0) return { hours: '', minutes: '' };
    const rounded = Math.round(value);
    return {
        hours: String(Math.floor(rounded / 60)),
        minutes: String(rounded % 60).padStart(2, '0'),
    };
}

export function DurationInput({ value, onChange, autoFocus = false, onFocus }: Props) {
    const initialParts = durationParts(value);
    const [hours, setHours] = useState(initialParts.hours);
    const [minutes, setMinutes] = useState(initialParts.minutes);
    const lastEmittedValue = useRef<number | null>(value);

    useEffect(() => {
        if (value === lastEmittedValue.current) return;
        lastEmittedValue.current = value;
        const parts = durationParts(value);
        setHours(parts.hours);
        setMinutes(parts.minutes);
    }, [value]);

    const updateValue = (nextHours: string, nextMinutes: string) => {
        setHours(nextHours);
        setMinutes(nextMinutes);
        if (nextHours === '' || nextMinutes === '') {
            lastEmittedValue.current = null;
            onChange(null);
            return;
        }

        const parsedHours = Number(nextHours);
        const parsedMinutes = Number(nextMinutes);
        const nextValue = Number.isSafeInteger(parsedHours) && parsedHours >= 0
            && Number.isSafeInteger(parsedMinutes) && parsedMinutes >= 0 && parsedMinutes < 60
            ? parsedHours * 60 + parsedMinutes
            : null;
        lastEmittedValue.current = nextValue;
        onChange(nextValue);
    };

    return (
        <Stack direction="row" spacing={0.75} alignItems="center">
            <TextField
                type="number"
                autoComplete="off"
                size="small"
                label="Hours"
                value={hours}
                onChange={event => updateValue(event.target.value, minutes)}
                onFocus={onFocus}
                inputProps={{ min: 0, step: 1, inputMode: 'numeric', 'aria-label': 'Duration hours' }}
                autoFocus={autoFocus}
                sx={{ width: 92 }}
            />
            <Typography color="text.secondary">:</Typography>
            <TextField
                type="number"
                autoComplete="off"
                size="small"
                label="Minutes"
                value={minutes}
                onChange={event => updateValue(hours, event.target.value)}
                onFocus={onFocus}
                inputProps={{ min: 0, max: 59, step: 1, inputMode: 'numeric', 'aria-label': 'Duration minutes' }}
                sx={{ width: 100 }}
            />
        </Stack>
    );
}
