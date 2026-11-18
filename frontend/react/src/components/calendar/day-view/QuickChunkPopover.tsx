import { useState } from 'react';
import { Alert, Button, Popover, Stack, TextField, Typography } from '@mui/material';
import { format } from 'date-fns';
import { ActivityPicker } from '../../activity/ActivityPicker';
import { Activity } from '../../../types/Activity';
import { CalendarEventInput } from '../../../types/CalendarEvent';

export interface ChunkDraft {
    start: number;
    end: number;
    anchor: { top: number; left: number };
}

interface QuickChunkPopoverProps {
    draft: ChunkDraft | null;
    activities: Activity[];
    onClose: () => void;
    onCreate: (input: CalendarEventInput) => Promise<void>;
}

function withTime(base: number, time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date(base);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
}

/** Plans a chunk of time from a click on the day view: what it is for, and when. */
export function QuickChunkPopover({ draft, activities, onClose, onCreate }: QuickChunkPopoverProps) {
    return (
        <Popover
            open={draft !== null}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={draft?.anchor}
            slotProps={{ paper: { sx: { p: 2, width: 340, maxWidth: 'calc(100vw - 32px)', borderRadius: 2 } } }}
        >
            {/* Keyed so each new draft starts with fresh fields. */}
            {draft && <ChunkForm key={`${draft.start}-${draft.end}`} draft={draft} activities={activities} onClose={onClose} onCreate={onCreate} />}
        </Popover>
    );
}

function ChunkForm({ draft, activities, onClose, onCreate }: Omit<QuickChunkPopoverProps, 'draft'> & { draft: ChunkDraft }) {
    const [activityId, setActivityId] = useState<string | null>(activities[0]?.id ?? null);
    const [title, setTitle] = useState(activities[0]?.name ?? '');
    const [start, setStart] = useState(format(draft.start, 'HH:mm'));
    const [end, setEnd] = useState(format(draft.end, 'HH:mm'));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const chooseActivity = (nextId: string | null) => {
        const previousName = activities.find(activity => activity.id === activityId)?.name;
        const nextName = activities.find(activity => activity.id === nextId)?.name;
        if (nextName && (!title.trim() || title === previousName)) setTitle(nextName);
        setActivityId(nextId);
    };

    const save = async () => {
        const startMs = withTime(draft.start, start);
        const endMs = withTime(draft.start, end);
        if (!title.trim()) return setError('Give it a name.');
        if (!(endMs > startMs)) return setError('The end needs to be after the start.');
        setSaving(true);
        setError(null);
        try {
            await onCreate({
                title: title.trim(),
                activityId,
                description: '',
                allDay: false,
                startDate: null,
                endDate: null,
                startTime: new Date(startMs).toISOString(),
                endTime: new Date(endMs).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                status: 'CONFIRMED',
                recurrenceFrequency: 'NONE',
                recurrenceEndDate: null,
                recurrenceInterval: null,
                recurrenceUnit: null,
                reminderMinutesBefore: null,
            });
            onClose();
        } catch (saveError) {
            console.error('Could not plan the chunk:', saveError);
            setError(saveError instanceof Error ? saveError.message : 'Could not save it.');
            setSaving(false);
        }
    };

    return (
        <Stack spacing={1.5} component="form" onSubmit={event => { event.preventDefault(); void save(); }}>
            <Typography variant="subtitle1" fontWeight={700}>Plan a chunk</Typography>
            <ActivityPicker activities={activities} value={activityId} onChange={chooseActivity} />
            <TextField label="Name" size="small" value={title} onChange={event => setTitle(event.target.value)} autoComplete="off" autoFocus={activities.length === 0} />
            <Stack direction="row" spacing={1}>
                <TextField label="From" type="time" size="small" value={start} onChange={event => setStart(event.target.value)} sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Until" type="time" size="small" value={end} onChange={event => setEnd(event.target.value)} sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Plan it'}</Button>
            </Stack>
        </Stack>
    );
}
