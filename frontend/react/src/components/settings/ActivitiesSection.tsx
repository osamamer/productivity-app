import { useState } from 'react';
import { Alert, Box, Button, IconButton, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useActivities } from '../../hooks/useActivities';
import { activityStore } from '../../services/cache/activityStore';
import { Activity, ActivityColor } from '../../types/Activity';
import { ACTIVITY_COLOR_ORDER, ACTIVITY_COLORS } from '../activity/activityColors';
import { ActivitySuggestions } from '../activity/ActivitySuggestions';

interface ActivitiesSectionProps {
    cardSx: object;
    headingSx: object;
}

function ColorButton({ color, onChange }: { color: ActivityColor; onChange: (color: ActivityColor) => void }) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    return (
        <>
            <Tooltip title="Colour">
                <IconButton size="small" aria-label="Change colour" onClick={event => setAnchor(event.currentTarget)}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: ACTIVITY_COLORS[color] }} />
                </IconButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
                <Stack direction="row" spacing={0.5} sx={{ px: 1 }}>
                    {ACTIVITY_COLOR_ORDER.map(option => (
                        <MenuItem key={option} sx={{ p: 0.75, borderRadius: 1 }} selected={option === color} aria-label={option}
                            onClick={() => { onChange(option); setAnchor(null); }}>
                            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: ACTIVITY_COLORS[option] }} />
                        </MenuItem>
                    ))}
                </Stack>
            </Menu>
        </>
    );
}

function ActivityRow({ activity, onError }: { activity: Activity; onError: (message: string) => void }) {
    const [name, setName] = useState(activity.name);
    const save = (input: { name?: string; color?: ActivityColor }) => {
        activityStore.update(activity.id, input).catch((error: Error) => {
            console.error('Could not save the activity:', error);
            onError(error.message);
            setName(activity.name);
        });
    };
    return (
        <Stack direction="row" alignItems="center" spacing={1}>
            <ColorButton color={activity.color} onChange={color => save({ color })} />
            <TextField
                size="small"
                value={name}
                onChange={event => setName(event.target.value)}
                onBlur={() => { if (name.trim() && name.trim() !== activity.name) save({ name: name.trim() }); }}
                onKeyDown={event => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
                inputProps={{ 'aria-label': `${activity.name} name`, maxLength: 60 }}
                sx={{ flex: 1 }}
            />
            <Tooltip title="Delete. Chunks keep their time but lose the label.">
                <IconButton size="small" aria-label={`Delete ${activity.name}`} onClick={() => {
                    activityStore.remove(activity.id).catch((error: Error) => {
                        console.error('Could not delete the activity:', error);
                        onError(error.message);
                    });
                }}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>
    );
}

/** Settings: the activities chunks of time can be planned for. */
export function ActivitiesSection({ cardSx, headingSx }: ActivitiesSectionProps) {
    const activities = useActivities();
    const [newName, setNewName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        if (!newName.trim()) return;
        setError(null);
        try {
            const color = ACTIVITY_COLOR_ORDER[(activities?.length ?? 0) % ACTIVITY_COLOR_ORDER.length];
            await activityStore.create({ name: newName.trim(), color });
            setNewName('');
        } catch (addError) {
            console.error('Could not add the activity:', addError);
            setError(addError instanceof Error ? addError.message : 'Could not add it.');
        }
    };

    return (
        <Box sx={cardSx}>
            <Box sx={headingSx}>
                <CategoryOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Activities</Typography>
            </Box>
            {activities?.length === 0 ? (
                <ActivitySuggestions />
            ) : (
                <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                        Label chunks of time in the calendar with what they are for.
                    </Typography>
                    {(activities ?? []).map(activity => <ActivityRow key={activity.id} activity={activity} onError={setError} />)}
                </Stack>
            )}
            <Stack direction="row" spacing={1} component="form" sx={{ mt: 1.5 }} onSubmit={event => { event.preventDefault(); void add(); }}>
                <TextField size="small" placeholder="New activity" value={newName} onChange={event => setNewName(event.target.value)}
                    inputProps={{ 'aria-label': 'New activity name', maxLength: 60 }} sx={{ flex: 1 }} />
                <Button type="submit" variant="outlined" disabled={!newName.trim()}>Add</Button>
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        </Box>
    );
}
