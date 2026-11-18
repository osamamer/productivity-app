import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { PomodoroNumberField } from '../timer/PomodoroNumberField';

/** Laid out like the pomodoro setup: one length field (0 runs an open timer) and Start. */
export function LeisureStartPanel({ defaultMinutes, onStart }: {
    defaultMinutes: number;
    onStart: (minutes: number) => Promise<void>;
}) {
    const [minutes, setMinutes] = useState(defaultMinutes);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const start = async () => {
        setBusy(true);
        setError(null);
        try {
            await onStart(minutes);
        } catch (startError) {
            console.error('Could not start the timer:', startError);
            setError('Could not start the timer.');
            setBusy(false);
        }
    };

    return (
        <Box component="form" noValidate onSubmit={event => { event.preventDefault(); void start(); }}>
            <Box sx={{ mb: 1.5 }}>
                <PomodoroNumberField name="minutes" label="Minutes (0 = no end)" value={minutes} onChange={setMinutes} min={0} max={600} />
            </Box>
            <Button type="submit" variant="outlined" size="small" fullWidth disabled={busy} startIcon={<PlayArrowIcon />}>
                Start
            </Button>
            {error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'left' }}>{error}</Typography>}
        </Box>
    );
}
