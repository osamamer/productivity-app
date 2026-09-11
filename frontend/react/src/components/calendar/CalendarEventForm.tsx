import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControlLabel, Menu, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { CalendarEvent, CalendarEventInput, CalendarEventStatus, RecurrenceFrequency, RecurrenceUnit } from '../../types/CalendarEvent';
import { readEventTimePreferences, saveEventTimePreferences } from '../../services/utils/inputPreferences';
import { AppDateField, AppTimeField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';
import { useKeyboardDelete } from '../../hooks/useKeyboardDelete';

type Props = {
    initialDate: string;
    event?: CalendarEvent | null;
    occurrenceKey?: string;
    occurrenceDate?: string;
    occurrenceStatus?: CalendarEventStatus;
    onSave: (event: CalendarEventInput) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    onDeleteOccurrence?: () => Promise<void>;
    onCancelOccurrence?: () => Promise<void>;
    onRestoreOccurrence?: () => Promise<void>;
    onUpdateOccurrenceStatus?: (status: CalendarEventStatus) => Promise<void>;
};

type DeleteScope = 'occurrence' | 'all';

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

const STATUS_OPTIONS: { value: CalendarEventStatus; label: string }[] = [
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'TENTATIVE', label: 'Tentative' },
    { value: 'CANCELLED', label: 'Cancelled' },
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

export function CalendarEventForm({
    initialDate,
    event,
    occurrenceKey,
    occurrenceDate,
    occurrenceStatus,
    onSave,
    onCancel,
    onDelete,
    onDeleteOccurrence,
    onCancelOccurrence,
    onRestoreOccurrence,
    onUpdateOccurrenceStatus,
}: Props) {
    const [rememberedTimes] = useState(() => event ? {} : readEventTimePreferences());
    const [title, setTitle] = useState(event?.title ?? '');
    const [description, setDescription] = useState(event?.description ?? '');
    const [allDay, setAllDay] = useState(event?.allDay ?? false);
    const [startDate, setStartDate] = useState(event?.startDate ?? localDatePart(event?.startTime, initialDate));
    const [endDate, setEndDate] = useState(event?.endDate ?? localDatePart(event?.endTime, initialDate));
    const [startTime, setStartTime] = useState(localTimePart(event?.startTime, rememberedTimes.startTime ?? '17:00'));
    const [endTime, setEndTime] = useState(localTimePart(event?.endTime, rememberedTimes.endTime ?? '18:00'));
    const [status, setStatus] = useState<CalendarEventStatus>(occurrenceStatus ?? event?.status ?? 'CONFIRMED');
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
    const [cancelMenuAnchor, setCancelMenuAnchor] = useState<HTMLElement | null>(null);
    const [deleteMenuAnchor, setDeleteMenuAnchor] = useState<HTMLElement | null>(null);
    const [deleteScope, setDeleteScope] = useState<DeleteScope | null>(null);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const isRepeatingOccurrence = Boolean(
        event
        && (event.recurrenceFrequency ?? 'NONE') !== 'NONE'
        && occurrenceKey
    );

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

    const buildInput = (): CalendarEventInput | null => {
        if (!title.trim()) {
            setError('Add a title for the event.');
            return null;
        }
        if (recurrenceFrequency === 'CUSTOM'
            && (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 999)) {
            setError('Custom repeat must be between 1 and 999.');
            return null;
        }

        let startInstant: string | null = null;
        let endInstant: string | null = null;
        if (!allDay) {
            const start = new Date(`${startDate}T${startTime}:00`);
            const end = new Date(`${endDate}T${endTime}:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
                setError('Finish must be after the start.');
                return null;
            }
            startInstant = start.toISOString();
            endInstant = end.toISOString();
        } else if (endDate < startDate) {
            setError('Finish date cannot be before the start date.');
            return null;
        }

        return {
            title: title.trim(),
            description: description.trim(),
            allDay,
            startDate: allDay ? startDate : null,
            endDate: allDay ? endDate : null,
            startTime: startInstant,
            endTime: endInstant,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            status: isRepeatingOccurrence ? event!.status : status,
            recurrenceFrequency,
            recurrenceEndDate: recurrenceFrequency === 'NONE' || !recurrenceEndDate ? null : recurrenceEndDate,
            recurrenceInterval: recurrenceFrequency === 'CUSTOM' ? recurrenceInterval : null,
            recurrenceUnit: recurrenceFrequency === 'CUSTOM' ? recurrenceUnit : null,
            reminderMinutesBefore: reminderMinutes,
        };
    };

    const submit = async (statusOverride?: CalendarEventStatus) => {
        const input = buildInput();
        if (!input) return;

        setSaving(true);
        setError(null);
        try {
            if (isRepeatingOccurrence && statusOverride === undefined
                && onUpdateOccurrenceStatus && status !== occurrenceStatus) {
                await onUpdateOccurrenceStatus(status);
            }
            await onSave(statusOverride === undefined ? input : { ...input, status: statusOverride });
            if (!allDay) saveEventTimePreferences(startTime, endTime);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save the event.');
        } finally {
            setSaving(false);
        }
    };

    const occurrenceCanBeCancelled = Boolean(
        event
        && recurrenceFrequency !== 'NONE'
        && occurrenceKey
        && event.status !== 'CANCELLED'
        && onCancelOccurrence
        && occurrenceStatus !== 'CANCELLED'
    );
    const occurrenceCanBeRestored = Boolean(
        event
        && recurrenceFrequency !== 'NONE'
        && occurrenceKey
        && event.status !== 'CANCELLED'
        && onRestoreOccurrence
        && occurrenceStatus === 'CANCELLED'
    );
    const canCancelRepeatingEvent = Boolean(
        event
        && recurrenceFrequency !== 'NONE'
        && event.status !== 'CANCELLED'
        && (onCancelOccurrence || onSave)
    );

    const runOccurrenceAction = async (action: (() => Promise<void>) | undefined) => {
        if (!action) return;
        setDeleting(true);
        setError(null);
        try {
            await action();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update the event occurrence.');
            setDeleting(false);
        }
    };

    const openDeleteConfirmation = (scope: DeleteScope) => {
        setDeleteScope(scope);
        setDeleteConfirmationOpen(true);
    };

    const remove = async () => {
        if (!deleteScope || (deleteScope === 'occurrence' ? !onDeleteOccurrence : !onDelete)) return;
        setDeleteConfirmationOpen(false);
        setDeleting(true);
        setError(null);
        try {
            if (deleteScope === 'occurrence') await onDeleteOccurrence!();
            else await onDelete!();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete the event.');
            setDeleting(false);
        }
    };

    useKeyboardDelete({
        enabled: Boolean(onDelete) && !saving && !deleting && !deleteConfirmationOpen && !deleteMenuAnchor,
        allowDialog: true,
        onDelete: () => {
            if (event && recurrenceFrequency !== 'NONE' && occurrenceKey && onDeleteOccurrence) {
                openDeleteConfirmation('occurrence');
            } else {
                openDeleteConfirmation('all');
            }
        },
    });

    const canDeleteOccurrence = Boolean(
        event && recurrenceFrequency !== 'NONE' && occurrenceKey && onDeleteOccurrence,
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <TextField label="Event title" value={title} onChange={e => setTitle(e.target.value)} autoFocus autoComplete="off" fullWidth />
            <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} autoComplete="off"
                       multiline minRows={2} maxRows={5} fullWidth />

            <TextField select label={event && recurrenceFrequency !== 'NONE' && !occurrenceKey ? 'Series status' : 'Status'} value={status} autoComplete="off"
                       onChange={e => setStatus(e.target.value as CalendarEventStatus)} fullWidth>
                {STATUS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>

            {event && recurrenceFrequency !== 'NONE' && occurrenceDate && (
                <Typography variant="caption" color="text.secondary">
                    Selected occurrence: {occurrenceDate}
                </Typography>
            )}

            <FormControlLabel
                control={<Switch checked={allDay} onChange={e => setAllDay(e.target.checked)} />}
                label="All day"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <AppDateField label="Start date" value={startDate} onChange={handleStartDateChange} />
                {!allDay && <AppTimeField label="Start time" value={startTime} onChange={handleStartTimeChange} />}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <AppDateField label="Finish date" value={endDate} onChange={setEndDate} />
                {!allDay && <AppTimeField label="Finish time" value={endTime} onChange={setEndTime} />}
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
                        <AppNumberField label="Every" value={recurrenceInterval} autoComplete="off"
                                   onChange={e => setRecurrenceInterval(Number(e.target.value))}
                                   onStepValueChange={setRecurrenceInterval}
                                   min={1} max={999} step={1} fullWidth />
                        <TextField select label="Unit" value={recurrenceUnit} autoComplete="off"
                                   onChange={e => setRecurrenceUnit(e.target.value as RecurrenceUnit)} fullWidth>
                            {RECURRENCE_UNIT_OPTIONS.map(option => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                        </TextField>
                    </>
                )}
                {recurrenceFrequency !== 'NONE' && (
                    <AppDateField label="Repeat until (optional)" value={recurrenceEndDate} onChange={setRecurrenceEndDate} />
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
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent={onDelete ? 'space-between' : 'flex-end'} spacing={1}>
                <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                    {occurrenceCanBeRestored && (
                        <Button color="primary" onClick={() => void runOccurrenceAction(onRestoreOccurrence)} disabled={saving || deleting}>
                            Restore this occurrence
                        </Button>
                    )}
                    {canCancelRepeatingEvent && (
                        <Button color="error" onClick={event => setCancelMenuAnchor(event.currentTarget)} disabled={saving || deleting}>
                            Cancel event
                        </Button>
                    )}
                    {onDelete && (
                        <Button
                            color="error"
                            onClick={buttonEvent => {
                                if (canDeleteOccurrence) setDeleteMenuAnchor(buttonEvent.currentTarget);
                                else openDeleteConfirmation('all');
                            }}
                            disabled={saving || deleting}
                        >
                            {event && recurrenceFrequency !== 'NONE' ? 'Delete' : 'Delete'}
                        </Button>
                    )}
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Button onClick={onCancel} disabled={saving || deleting}>Cancel</Button>
                    <Button variant="contained" onClick={() => void submit()} disabled={saving || deleting}>
                        {saving ? 'Saving…' : event ? 'Save' : 'Add event'}
                    </Button>
                </Stack>
            </Stack>
            <Menu
                anchorEl={cancelMenuAnchor}
                open={Boolean(cancelMenuAnchor)}
                onClose={() => setCancelMenuAnchor(null)}
            >
                <MenuItem
                    disabled={!occurrenceCanBeCancelled}
                    onClick={() => {
                        setCancelMenuAnchor(null);
                        void runOccurrenceAction(onCancelOccurrence);
                    }}
                >
                    This occurrence
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setCancelMenuAnchor(null);
                        void submit('CANCELLED');
                    }}
                >
                All occurrences
                </MenuItem>
            </Menu>
            <Menu
                anchorEl={deleteMenuAnchor}
                open={Boolean(deleteMenuAnchor)}
                onClose={() => setDeleteMenuAnchor(null)}
            >
                <MenuItem
                    disabled={!canDeleteOccurrence}
                    onClick={() => {
                        setDeleteMenuAnchor(null);
                        openDeleteConfirmation('occurrence');
                    }}
                >
                    This occurrence
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setDeleteMenuAnchor(null);
                        openDeleteConfirmation('all');
                    }}
                >
                    All occurrences
                </MenuItem>
            </Menu>
            <Dialog
                open={deleteConfirmationOpen}
                onClose={() => !deleting && setDeleteConfirmationOpen(false)}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>
                    {deleteScope === 'occurrence' ? 'Delete this occurrence?' : 'Delete event?'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {deleteScope === 'occurrence'
                            ? 'This occurrence will be removed from your calendar. This cannot be undone.'
                            : event && recurrenceFrequency !== 'NONE'
                                ? 'All occurrences of this event will be removed from your calendar. This cannot be undone.'
                                : 'This event will be removed from your calendar. This cannot be undone.'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmationOpen(false)} disabled={deleting}>Keep event</Button>
                    <Button color="error" variant="contained" onClick={() => void remove()} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
