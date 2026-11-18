import { useState } from 'react';
import { Alert, Button, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { activityStore } from '../../services/cache/activityStore';
import { ACTIVITY_COLORS, SUGGESTED_ACTIVITIES } from './activityColors';

/** For someone with no activities yet: what they are for, and a few to add in one click. */
export function ActivitySuggestions() {
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addAll = async () => {
        setAdding(true);
        setError(null);
        try {
            for (const [index, suggestion] of SUGGESTED_ACTIVITIES.entries()) {
                await activityStore.create({ ...suggestion, displayOrder: index });
            }
        } catch (addError) {
            console.error('Could not add the suggested activities:', addError);
            setError(addError instanceof Error ? addError.message : 'Could not add them.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <Stack spacing={1.25} sx={{ textAlign: 'left' }}>
            <Typography variant="subtitle1" fontWeight={700}>Plan your day in chunks</Typography>
            <Typography variant="body2" color="text.secondary">
                Activities label chunks of time, like focus or leisure, so the day view can show how the day is split.
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {SUGGESTED_ACTIVITIES.map(suggestion => (
                    <Chip key={suggestion.name} size="small" label={suggestion.name}
                        sx={{ border: 1, borderColor: ACTIVITY_COLORS[suggestion.color], bgcolor: alpha(ACTIVITY_COLORS[suggestion.color], 0.12) }} />
                ))}
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="outlined" onClick={() => void addAll()} disabled={adding} sx={{ alignSelf: 'flex-start' }}>
                {adding ? 'Adding…' : 'Add these'}
            </Button>
        </Stack>
    );
}
