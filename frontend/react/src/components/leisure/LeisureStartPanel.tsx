import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { PomodoroNumberField } from '../timer/PomodoroNumberField';
import { formatScreenDuration } from '../day/screenTimeText';

const MAX_HOURS = 24;

/** Length of a countdown as hours and minutes; Tab moves from hours to minutes. Zero runs an open timer. */
export function LeisureStartPanel({ defaultMinutes, onStart }: {
    defaultMinutes: number;
    onStart: (minutes: number) => Promise<void>;
}) {
    const [hours, setHours] = useState(Math.floor(defaultMinutes / 60));
    const [minutesPart, setMinutesPart] = useState(defaultMinutes % 60);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const totalMinutes = hours * 60 + minutesPart;

    const start = async () => {
        setBusy(true);
        setError(null);
        try {
            await onStart(totalMinutes);
        } catch (startError) {
            console.error('Could not start the timer:', startError);
            setError('Could not start the timer.');
            setBusy(false);
        }
    };

    return (
        <Box component="form" noValidate onSubmit={event => { event.preventDefault(); void start(); }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <PomodoroNumberField name="hours" label="Hours" value={hours} onChange={setHours} min={0} max={MAX_HOURS} />
                <PomodoroNumberField name="minutes" label="Minutes" value={minutesPart} onChange={setMinutesPart} min={0} max={59} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, textAlign: 'left' }}>
                {totalMinutes > 0 ? `Ends after ${formatScreenDuration(totalMinutes * 60_000)}` : 'No end: counts up until you stop it'}
            </Typography>
            <Button type="submit" variant="outlined" size="small" fullWidth disabled={busy} startIcon={<PlayArrowIcon />}>
                Start
            </Button>
            {error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'left' }}>{error}</Typography>}
        </Box>
    );
}
