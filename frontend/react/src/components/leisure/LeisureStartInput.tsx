import { useState } from 'react';
import { Box, Collapse, TextField } from '@mui/material';
import { Activity } from '../../types/Activity';
import { StartActivitySessionInput } from '../../types/ActivitySession';
import { ActivityPicker } from '../activity/ActivityPicker';

/** The leisure counterpart of the Home task input: type what you are doing and press Enter to time it. */
export function LeisureStartInput({ activities, disabled, onStart }: {
    activities: Activity[];
    disabled: boolean;
    onStart: (input: StartActivitySessionInput) => Promise<void>;
}) {
    const [title, setTitle] = useState('');
    const [activityId, setActivityId] = useState<string | null>(null);
    const [focused, setFocused] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const chooseActivity = (nextId: string | null) => {
        const previousName = activities.find(activity => activity.id === activityId)?.name;
        const nextName = activities.find(activity => activity.id === nextId)?.name;
        if (nextName && (!title.trim() || title === previousName)) setTitle(nextName);
        setActivityId(nextId);
    };

    const submit = async () => {
        if (!activityId && !title.trim()) return;
        setBusy(true);
        setError(null);
        try {
            await onStart({ activityId, title: title.trim() || undefined, targetEndAt: null });
            setTitle('');
            setActivityId(null);
        } catch (startError) {
            console.error('Could not start the timer:', startError);
            setError('Could not start the timer.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box component="form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <TextField
                variant="standard"
                fullWidth
                placeholder={disabled ? 'A timer is running' : 'What are you doing?'}
                value={title}
                disabled={disabled || busy}
                error={Boolean(error)}
                helperText={error ?? undefined}
                autoComplete="off"
                onChange={event => setTitle(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                inputProps={{ 'aria-label': 'Start a timer for' }}
            />
            <Collapse in={!disabled && (focused || title.length > 0 || activityId !== null)}>
                <Box sx={{ pt: 1.25, pb: 0.5 }} onMouseDown={event => event.preventDefault()}>
                    <ActivityPicker activities={activities} value={activityId} onChange={chooseActivity} />
                </Box>
            </Collapse>
        </Box>
    );
}
