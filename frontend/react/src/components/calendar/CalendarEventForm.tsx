import {
    Alert, Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { CalendarEvent, CalendarEventInput, RecurrenceFrequency, RecurrenceUnit } from '../../types/CalendarEvent';

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

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
    { value: 'NONE', label: 'Does not repeat' },
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'CUSTOM', label: 'Custom…' },
];

const RECURRENCE_UNIT_OPTIONS: { value: RecurrenceUnit; label: string }[] = [
    { value: 'DAYS', label: 'days' },
    { value: 'WEEKS', label: 'weeks' },
    { value: 'MONTHS', label: 'months' },
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

function addHour(time: string): { time: string; crossesMidnight: boolean } {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + 60;
    const normalizedMinutes = totalMinutes % (24 * 60);
    return {
        time: `${String(Math.floor(normalizedMinutes / 60)).padStart(2, '0')}:${String(normalizedMinutes % 60).padStart(2, '0')}`,
        crossesMidnight: totalMinutes >= 24 * 60,
    };
}

function addDay(date: string): string {
    const nextDate = new Date(`${date}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
}

export function CalendarEventForm({ initialDate, event, onSave, onCancel, onDelete }: Props) {
    const [title, setTitle] = useState(event?.title ?? '');
    const [description, setDescription] = useState(event?.description ?? '');
    const [allDay, setAllDay] = useState(event?.allDay ?? false);
    const [startDate, setStartDate] = useState(event?.startDate ?? localDatePart(event?.startTime, initialDate));
    const [endDate, setEndDate] = useState(event?.endDate ?? localDatePart(event?.endTime, initialDate));
    const [startTime, setStartTime] = useState(localTimePart(event?.startTime, '17:00'));
    const [endTime, setEndTime] = useState(localTimePart(event?.endTime, '18:00'));
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(
        event?.recurrenceFrequency ?? 'NONE'
    );
    const [recurrenceInterval, setRecurrenceInterval] = useState(event?.recurrenceInterval ?? 1);
    const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(event?.recurrenceUnit ?? 'WEEKS');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState(event?.recurrenceEndDate ?? '');
    const [reminderMinutes, setReminderMinutes] = useState<number | null>(event?.reminderMinutesBefore ?? 1440);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const customReminderOption = useMemo(
        () => REMINDER_OPTIONS.some(option => option.value === reminderMinutes) ? null : reminderMinutes,
        [reminderMinutes]
    );

    const handleStartTimeChange = (nextStartTime: string) => {
        setStartTime(nextStartTime);
        if (!nextStartTime || !endTime || startDate !== endDate || nextStartTime < endTime) return;

        const adjustedEnd = addHour(nextStartTime);
        setEndTime(adjustedEnd.time);
        if (adjustedEnd.crossesMidnight) setEndDate(addDay(startDate));
    };

    const handleStartDateChange = (nextStartDate: string) => {
        setStartDate(nextStartDate);
        if (!nextStartDate) return;

        if (allDay) {
            setEndDate(nextStartDate);
            return;
        }

        const adjustedEnd = addHour(startTime);
        setEndTime(adjustedEnd.time);
        setEndDate(adjustedEnd.crossesMidnight ? addDay(nextStartDate) : nextStartDate);
    };

    const submit = async () => {
        if (!title.trim()) {
            setError('Add a title for the event.');
            return;
        }
        if (recurrenceFrequency === 'CUSTOM'
            && (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 999)) {
            setError('Custom repeat must be between 1 and 999.');
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
            await onSave({
                title: title.trim(),
                description: description.trim(),
                allDay,
                startDate: allDay ? startDate : null,
                endDate: allDay ? endDate : null,
                startTime: startInstant,
                endTime: endInstant,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                recurrenceFrequency,
                recurrenceEndDate: recurrenceFrequency === 'NONE' || !recurrenceEndDate ? null : recurrenceEndDate,
                recurrenceInterval: recurrenceFrequency === 'CUSTOM' ? recurrenceInterval : null,
                recurrenceUnit: recurrenceFrequency === 'CUSTOM' ? recurrenceUnit : null,
                reminderMinutesBefore: reminderMinutes,
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
            <TextField label="Event title" value={title} onChange={e => setTitle(e.target.value)} autoFocus autoComplete="off" fullWidth />
            <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} autoComplete="off"
                       multiline minRows={2} maxRows={5} fullWidth />

            <FormControlLabel
                control={<Switch checked={allDay} onChange={e => setAllDay(e.target.checked)} />}
                label="All day"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Start date" type="date" value={startDate} autoComplete="off"
                           onChange={e => handleStartDateChange(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                {!allDay && <TextField label="Start time" type="time" value={startTime} autoComplete="off"
                                       onChange={e => handleStartTimeChange(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Finish date" type="date" value={endDate} autoComplete="off"
                           onChange={e => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                {!allDay && <TextField label="Finish time" type="time" value={endTime} autoComplete="off"
                                       onChange={e => setEndTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField select label="Repeat" value={recurrenceFrequency} autoComplete="off"
                           onChange={e => {
                               const nextFrequency = e.target.value as RecurrenceFrequency;
                               setRecurrenceFrequency(nextFrequency);
                               if (nextFrequency === 'NONE') setRecurrenceEndDate('');
                           }} fullWidth>
                    {RECURRENCE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                </TextField>
                {recurrenceFrequency === 'CUSTOM' && (
                    <>
                        <TextField label="Every" type="number" value={recurrenceInterval} autoComplete="off"
                                   onChange={e => setRecurrenceInterval(Number(e.target.value))}
                                   inputProps={{ min: 1, max: 999, step: 1 }} fullWidth />
                        <TextField select label="Unit" value={recurrenceUnit} autoComplete="off"
                                   onChange={e => setRecurrenceUnit(e.target.value as RecurrenceUnit)} fullWidth>
                            {RECURRENCE_UNIT_OPTIONS.map(option => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                        </TextField>
                    </>
                )}
                {recurrenceFrequency !== 'NONE' && (
                    <TextField label="Repeat until (optional)" type="date" value={recurrenceEndDate} autoComplete="off"
                               onChange={e => setRecurrenceEndDate(e.target.value)}
                               slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                )}
            </Stack>

            <Box>
                <TextField select label="Remind me" value={reminderMinutes ?? ''} autoComplete="off"
                           onChange={e => setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))} fullWidth>
                    <MenuItem value="">No reminder</MenuItem>
                    {customReminderOption !== null && (
                        <MenuItem value={customReminderOption}>{customReminderOption} minutes before</MenuItem>
                    )}
                    {REMINDER_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                </TextField>
                {reminderMinutes !== null && 'Notification' in window && Notification.permission === 'denied' && (
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
