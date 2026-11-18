import { useState } from 'react';
import { Alert, Button, Card, Divider, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { format } from 'date-fns';
import { activityTimerStore } from '../../services/cache/activityTimerStore';
import { Activity } from '../../types/Activity';
import { StartActivitySessionInput } from '../../types/ActivitySession';
import { ActivityPicker } from '../activity/ActivityPicker';
import { PlannedChunk } from './nowPlan';

type Length = 'open' | 'chunk' | '25' | '50';

function targetFor(length: Length, chunk: PlannedChunk | null): string | null {
    if (length === 'chunk' && chunk) return new Date(chunk.end).toISOString();
    if (length === '25' || length === '50') return new Date(Date.now() + Number(length) * 60_000).toISOString();
    return null;
}

/** Nothing is being timed: start the chunk that is planned now, or time anything else. */
export function StartCard({ chunk, activities }: { chunk: PlannedChunk | null; activities: Activity[] }) {
    // Null until the user picks one, so the default follows the plan once it has loaded.
    const [length, setLength] = useState<Length | null>(null);
    const [activityId, setActivityId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chosen = length ?? (chunk ? 'chunk' : 'open');
    const effectiveLength = chosen === 'chunk' && !chunk ? 'open' : chosen;

    const start = async (input: StartActivitySessionInput) => {
        setBusy(true);
        setError(null);
        try {
            await activityTimerStore.start(input);
        } catch (startError) {
            console.error('Could not start the timer:', startError);
            setError(startError instanceof Error ? startError.message : 'Could not start the timer.');
            setBusy(false);
        }
    };

    const chooseActivity = (nextId: string | null) => {
        const previousName = activities.find(activity => activity.id === activityId)?.name;
        const nextName = activities.find(activity => activity.id === nextId)?.name;
        if (nextName && (!title.trim() || title === previousName)) setTitle(nextName);
        setActivityId(nextId);
    };

    return (
        <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
                <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary" fontWeight={650}>How long</Typography>
                    <ToggleButtonGroup size="small" exclusive value={effectiveLength} onChange={(_, next: Length | null) => next && setLength(next)} aria-label="Timer length">
                        {chunk && <ToggleButton value="chunk">Until {format(chunk.end, 'h:mm a')}</ToggleButton>}
                        <ToggleButton value="open">Open</ToggleButton>
                        <ToggleButton value="25">25 min</ToggleButton>
                        <ToggleButton value="50">50 min</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>

                {chunk && (
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<PlayArrowRoundedIcon />}
                        disabled={busy}
                        onClick={() => void start({ activityId: chunk.activityId, eventId: chunk.eventId, title: chunk.title, targetEndAt: targetFor(effectiveLength, chunk) })}
                        sx={{ py: 1.5, fontSize: '1.05rem', alignSelf: { sm: 'flex-start' } }}
                    >
                        Start {chunk.title}
                    </Button>
                )}

                {chunk && <Divider>or time something else</Divider>}

                <ActivityPicker activities={activities} value={activityId} onChange={chooseActivity} label={chunk ? 'Activity' : 'What are you doing?'} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} component="form"
                    onSubmit={event => { event.preventDefault(); void start({ activityId, title: title.trim() || undefined, targetEndAt: targetFor(effectiveLength === 'chunk' ? 'open' : effectiveLength, null) }); }}>
                    <TextField size="small" label="Name (optional)" value={title} onChange={event => setTitle(event.target.value)} autoComplete="off" sx={{ flex: 1 }} />
                    <Button type="submit" variant={chunk ? 'outlined' : 'contained'} startIcon={<PlayArrowRoundedIcon />} disabled={busy || (!activityId && !title.trim())}>
                        Start
                    </Button>
                </Stack>
                {error && <Alert severity="error">{error}</Alert>}
            </Stack>
        </Card>
    );
}
