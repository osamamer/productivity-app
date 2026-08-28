import {
    Alert, Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { CalendarEvent, CalendarEventInput } from '../../types/CalendarEvent';

type Props = {
    initialDate: string;
    event?: CalendarEvent | null;
    onSave: (event: CalendarEventInput) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
};

const REMINDER_OPTIONS = [
    { value: 5, label: '5 minutes before' },
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 1440, label: '1 day before' },
    { value: 10080, label: '1 week before' },
];

function localDatePart(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function localTimePart(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    const date = new Date(value);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export async function requestSystemNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

export function CalendarEventForm({ initialDate, event, onSave, onCancel, onDelete }: Props) {
    const [title, setTitle] = useState(event?.title ?? '');
    const [description, setDescription] = useState(event?.description ?? '');
    const [allDay, setAllDay] = useState(event?.allDay ?? false);
    const [startDate, setStartDate] = useState(event?.startDate ?? localDatePart(event?.startTime, initialDate));
    const [endDate, setEndDate] = useState(event?.endDate ?? localDatePart(event?.endTime, initialDate));
    const [startTime, setStartTime] = useState(localTimePart(event?.startTime, '09:00'));
    const [endTime, setEndTime] = useState(localTimePart(event?.endTime, '10:00'));
    const [reminderEnabled, setReminderEnabled] = useState(event ? event.reminderMinutesBefore !== null : true);
    const [reminderMinutes, setReminderMinutes] = useState(event?.reminderMinutesBefore ?? 1440);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const customReminderOption = useMemo(
        () => REMINDER_OPTIONS.some(option => option.value === reminderMinutes) ? null : reminderMinutes,
        [reminderMinutes]
    );

    const submit = async () => {
        if (!title.trim()) {
            setError('Add a title for the event.');
            return;
        }

        let startInstant: string | null = null;
        let endInstant: string | null = null;
        if (!allDay) {
            const start = new Date(`${startDate}T${startTime}:00`);
            const end = new Date(`${endDate}T${endTime}:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
                setError('Finish must be after the start.');
                return;
            }
            startInstant = start.toISOString();
            endInstant = end.toISOString();
        } else if (endDate < startDate) {
            setError('Finish date cannot be before the start date.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            if (reminderEnabled) await requestSystemNotificationPermission();
            await onSave({
                title: title.trim(),
                description: description.trim(),
                allDay,
                startDate: allDay ? startDate : null,
                endDate: allDay ? endDate : null,
                startTime: startInstant,
                endTime: endInstant,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                reminderMinutesBefore: reminderEnabled ? reminderMinutes : null,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save the event.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!onDelete) return;
        setDeleting(true);
        setError(null);
        try {
            await onDelete();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete the event.');
            setDeleting(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <TextField label="Event title" value={title} onChange={e => setTitle(e.target.value)} autoFocus fullWidth />
            <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)}
                       multiline minRows={2} maxRows={5} fullWidth />

            <FormControlLabel
                control={<Switch checked={allDay} onChange={e => setAllDay(e.target.checked)} />}
                label="All day"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Start date" type="date" value={startDate}
                           onChange={e => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                {!allDay && <TextField label="Start time" type="time" value={startTime}
                                       onChange={e => setStartTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Finish date" type="date" value={endDate}
                           onChange={e => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                {!allDay && <TextField label="Finish time" type="time" value={endTime}
                                       onChange={e => setEndTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />}
            </Stack>

            <Box>
                <FormControlLabel
                    control={<Switch checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} />}
                    label="System notification"
                />
                {reminderEnabled && (
                    <TextField select label="Remind me" value={reminderMinutes}
                               onChange={e => setReminderMinutes(Number(e.target.value))} fullWidth sx={{ mt: 1 }}>
                        {customReminderOption !== null && (
                            <MenuItem value={customReminderOption}>{customReminderOption} minutes before</MenuItem>
                        )}
                        {REMINDER_OPTIONS.map(option => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                    </TextField>
                )}
                {reminderEnabled && 'Notification' in window && Notification.permission === 'denied' && (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                        Notifications are blocked in this browser's site settings.
                    </Typography>
                )}
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" justifyContent={onDelete ? 'space-between' : 'flex-end'} spacing={1}>
                {onDelete && <Button color="error" onClick={() => void remove()} disabled={saving || deleting}>Delete</Button>}
                <Stack direction="row" spacing={1}>
                    <Button onClick={onCancel} disabled={saving || deleting}>Cancel</Button>
                    <Button variant="contained" onClick={() => void submit()} disabled={saving || deleting}>
                        {saving ? 'Saving…' : event ? 'Save' : 'Add event'}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}
