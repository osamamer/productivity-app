import { CompactPopover } from '../CompactPopover';
import {
    Alert, Box, Button, Checkbox, Chip, DialogActions, InputBase, ListItemIcon,
    DialogContent, DialogContentText, DialogTitle, FormControlLabel,
    Menu, MenuItem, Stack, Switch,
    TextField, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useRef, useState } from 'react';
import { CalendarEvent, CalendarEventInput, CalendarEventStatus, RecurrenceFrequency, RecurrenceUnit } from '../../types/CalendarEvent';
import { Calendar } from '../../types/Calendar';
import { readEventTimePreferences, saveEventTimePreferences } from '../../services/utils/inputPreferences';
import { AppDateField, AppTimeField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';
import { useKeyboardDelete } from '../../hooks/useKeyboardDelete';
import { TaskReminderPicker } from '../task/TaskReminderPicker';
import { CalendarChipSelect, CalendarSelect } from './CalendarSelect';

type Props = {
    initialDate: string;
    event?: CalendarEvent | null;
    calendars: Calendar[];
    visibleCalendars: Calendar[];
    occurrenceKey?: string;
    occurrenceDate?: string;
    occurrenceStatus?: CalendarEventStatus;
    autoFocusTitle?: boolean;
    hideTitleField?: boolean;
    hideRecurrenceFields?: boolean;
    autoSaveOnBlur?: boolean;
    onSave: (event: CalendarEventInput) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => Promise<void>;
    onDeleteOccurrence?: () => Promise<void>;
    onCancelOccurrence?: () => Promise<void>;
    onRestoreOccurrence?: () => Promise<void>;
    onUpdateOccurrenceStatus?: (status: CalendarEventStatus) => Promise<void>;
};

type DeleteScope = 'occurrence' | 'all';

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

function eventStatusLabel(status: CalendarEventStatus): string {
    if (status === 'TENTATIVE') return 'Tentative';
    if (status === 'CANCELLED') return 'Cancelled';
    return 'Confirmed';
}

function eventStatusColor(status: CalendarEventStatus, theme: ReturnType<typeof useTheme>): string {
    if (status === 'TENTATIVE') return theme.palette.mode === 'dark' ? '#d9bc72' : '#ad7c2e';
    if (status === 'CANCELLED') return theme.palette.error.main;
    return theme.palette.primary.main;
}

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
    calendars,
    visibleCalendars,
    occurrenceKey,
    occurrenceDate,
    occurrenceStatus,
    autoFocusTitle = true,
    hideTitleField = false,
    hideRecurrenceFields = false,
    autoSaveOnBlur = false,
    onSave,
    onCancel,
    onDelete,
    onDeleteOccurrence,
    onCancelOccurrence,
    onRestoreOccurrence,
    onUpdateOccurrenceStatus,
}: Props) {
    const theme = useTheme();
    const [rememberedTimes] = useState(() => event ? {} : readEventTimePreferences());
    const [title, setTitle] = useState(event?.title ?? '');
    const [calendarId, setCalendarId] = useState(event?.calendarId
        ?? (visibleCalendars.length === 1 ? visibleCalendars[0].id : ''));
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
    const [statusMenuAnchor, setStatusMenuAnchor] = useState<HTMLElement | null>(null);
    const [deleteMenuAnchor, setDeleteMenuAnchor] = useState<HTMLElement | null>(null);
    const [deleteScope, setDeleteScope] = useState<DeleteScope | null>(null);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [deleteConfirmationAnchor, setDeleteConfirmationAnchor] = useState<{ top: number; left: number } | null>(null);
    const formRef = useRef<HTMLDivElement | null>(null);
    const autoSaveDirtyRef = useRef(false);
    const savingRef = useRef(false);
    const isRepeatingOccurrence = Boolean(
        event
        && (event.recurrenceFrequency ?? 'NONE') !== 'NONE'
        && occurrenceKey
    );

    const handleStartTimeChange = (nextStartTime: string) => {
        autoSaveDirtyRef.current = true;
        setStartTime(nextStartTime);
        if (!nextStartTime) return;

        const adjustedEnd = addHour(nextStartTime);
        setEndTime(adjustedEnd.time);
        if (startDate) setEndDate(adjustedEnd.crossesMidnight ? addDay(startDate) : startDate);
    };

    const handleStartDateChange = (nextStartDate: string) => {
        autoSaveDirtyRef.current = true;
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
            title: (hideTitleField && event ? event.title : title).trim(),
            calendarId,
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
        if (savingRef.current) return;
        const input = buildInput();
        if (!input) return;

        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            if (isRepeatingOccurrence && statusOverride === undefined
                && onUpdateOccurrenceStatus && status !== occurrenceStatus) {
                await onUpdateOccurrenceStatus(status);
            }
            await onSave(statusOverride === undefined ? input : { ...input, status: statusOverride });
            if (!allDay) saveEventTimePreferences(startTime, endTime);
            autoSaveDirtyRef.current = false;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save the event.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const saveWhenFocusLeavesForm = () => {
        if (!autoSaveOnBlur) return;
        window.setTimeout(() => {
            const activeElement = document.activeElement;
            if (formRef.current?.contains(activeElement)) return;
            if (activeElement instanceof HTMLElement
                && activeElement.closest('.MuiPickersPopper-root, .MuiPickersLayout-root, .MuiMenu-root, .MuiPopover-root, .MuiDialog-root')) {
                return;
            }
            if (autoSaveDirtyRef.current) void submit();
        }, 0);
    };

    const markAutoSaveDirty = () => {
        if (autoSaveOnBlur) autoSaveDirtyRef.current = true;
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

    const openDeleteConfirmation = (scope: DeleteScope, anchor?: HTMLElement | null) => {
        setDeleteScope(scope);
        setDeleteConfirmationAnchor(anchor
            ? { top: anchor.getBoundingClientRect().bottom, left: anchor.getBoundingClientRect().left }
            : null);
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
        <Box
            ref={formRef}
            onBlurCapture={saveWhenFocusLeavesForm}
            onChangeCapture={markAutoSaveDirty}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}
        >
            {event && !hideTitleField ? (
                <DialogTitle component="div" sx={{ p: 0, pb: 0.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <InputBase
                                value={title}
                                onChange={changeEvent => setTitle(changeEvent.target.value)}
                                onKeyDown={keyboardEvent => {
                                    if (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey
                                        || keyboardEvent.nativeEvent.isComposing) return;
                                    keyboardEvent.preventDefault();
                                    void submit();
                                }}
                                inputProps={{ 'aria-label': 'Event title' }}
                                autoFocus={autoFocusTitle}
                                fullWidth
                                sx={{
                                    fontSize: '1.25rem',
                                    fontWeight: 500,
                                    lineHeight: 1.6,
                                    '& input': {
                                        p: 0,
                                        borderBottom: '1px solid transparent',
                                        '&:hover': { borderBottomColor: 'divider' },
                                        '&:focus': { borderBottomColor: 'primary.main' },
                                    },
                                }}
                            />
                        </Box>
                        <CalendarChipSelect
                            calendars={calendars}
                            value={calendarId}
                            onChange={value => { markAutoSaveDirty(); setCalendarId(value); }}
                        />
                    </Stack>
                </DialogTitle>
            ) : !hideTitleField ? (
                <TextField
                    label="Event title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={keyboardEvent => {
                        if (event || keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey
                            || keyboardEvent.nativeEvent.isComposing) return;
                        keyboardEvent.preventDefault();
                        void submit();
                    }}
                    autoFocus={autoFocusTitle}
                    autoComplete="off"
                    fullWidth
                />
            ) : null}
            {!event && visibleCalendars.length > 1 && (
                <CalendarSelect
                    calendars={visibleCalendars}
                    value={calendarId}
                    onChange={value => { markAutoSaveDirty(); setCalendarId(value); }}
                />
            )}

            {event && recurrenceFrequency !== 'NONE' && occurrenceDate && (
                <Typography variant="caption" color="text.secondary">
                    Selected occurrence: {occurrenceDate}
                </Typography>
            )}

            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <FormControlLabel
                    control={<Switch checked={allDay} onChange={e => { markAutoSaveDirty(); setAllDay(e.target.checked); }} />}
                    label="All day"
                />
                <Chip
                    size="medium"
                    label={eventStatusLabel(status)}
                    onClick={clickEvent => setStatusMenuAnchor(clickEvent.currentTarget)}
                    aria-label={`Change event status, currently ${eventStatusLabel(status)}`}
                    sx={theme => {
                        const color = eventStatusColor(status, theme);
                        return {
                            height: 30,
                            borderRadius: '8px',
                            color,
                            bgcolor: alpha(color, 0.1),
                            fontWeight: 600,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: alpha(color, 0.18) },
                        };
                    }}
                />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <AppDateField label="Start date" value={startDate} onChange={handleStartDateChange} />
                {!allDay && <AppTimeField label="Start time" value={startTime} onChange={handleStartTimeChange} />}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <AppDateField label="Finish date" value={endDate} onChange={value => { markAutoSaveDirty(); setEndDate(value); }} />
                {!allDay && <AppTimeField label="Finish time" value={endTime} onChange={value => { markAutoSaveDirty(); setEndTime(value); }} />}
            </Stack>

            {!hideRecurrenceFields && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField select label="Repeat" value={recurrenceFrequency} autoComplete="off"
                               onChange={e => {
                                   markAutoSaveDirty();
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
                                       onChange={e => { markAutoSaveDirty(); setRecurrenceInterval(Number(e.target.value)); }}
                                       onStepValueChange={value => { markAutoSaveDirty(); setRecurrenceInterval(value); }}
                                       min={1} max={999} step={1} fullWidth />
                            <TextField select label="Unit" value={recurrenceUnit} autoComplete="off"
                                       onChange={e => { markAutoSaveDirty(); setRecurrenceUnit(e.target.value as RecurrenceUnit); }} fullWidth>
                                {RECURRENCE_UNIT_OPTIONS.map(option => (
                                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                ))}
                            </TextField>
                        </>
                    )}
                    {recurrenceFrequency !== 'NONE' && (
                        <AppDateField label="Repeat until (optional)" value={recurrenceEndDate} onChange={value => { markAutoSaveDirty(); setRecurrenceEndDate(value); }} />
                    )}
                </Stack>
            )}

            <TaskReminderPicker
                value={reminderMinutes}
                targetLabel="event"
                scheduledAt={startDate
                    ? `${startDate}T${allDay ? '00:00:00' : `${startTime}:00`}`
                    : null}
                disabled={!startDate || (!allDay && !startTime)}
                onChange={minutes => {
                    markAutoSaveDirty();
                    setReminderMinutes(minutes);
                    if (autoSaveOnBlur) window.setTimeout(() => void submit(), 0);
                }}
            />

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
                                else openDeleteConfirmation('all', buttonEvent.currentTarget);
                            }}
                            disabled={saving || deleting}
                        >
                            Delete
                        </Button>
                    )}
                </Stack>
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ ml: { sm: 'auto' }, alignSelf: { xs: 'flex-end', sm: 'auto' } }}
                >
                    {!autoSaveOnBlur && (
                        <Button onClick={onCancel} disabled={saving || deleting}>Cancel</Button>
                    )}
                    {!autoSaveOnBlur && (
                        <Button variant="contained" onClick={() => void submit()} disabled={saving || deleting}>
                            {saving ? 'Saving…' : event ? 'Save' : 'Add event'}
                        </Button>
                    )}
                </Stack>
            </Stack>
            <Menu
                anchorEl={statusMenuAnchor}
                open={Boolean(statusMenuAnchor)}
                onClose={() => setStatusMenuAnchor(null)}
                MenuListProps={{ disablePadding: true }}
                slotProps={{ paper: { sx: { borderRadius: '8px' } } }}
            >
                {STATUS_OPTIONS.map(option => {
                    const color = eventStatusColor(option.value, theme);
                    return (
                        <MenuItem
                            key={option.value}
                            selected={option.value === status}
                            onClick={() => {
                                markAutoSaveDirty();
                                setStatus(option.value);
                                setStatusMenuAnchor(null);
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 28 }}>
                                <Checkbox
                                    size="small"
                                    checked={option.value === status}
                                    disableRipple
                                    onChange={() => {}}
                                    sx={{ p: 0, color, '&.Mui-checked': { color } }}
                                />
                            </ListItemIcon>
                            {option.label}
                        </MenuItem>
                    );
                })}
            </Menu>
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
                        openDeleteConfirmation('occurrence', deleteMenuAnchor);
                    }}
                >
                    This occurrence
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setDeleteMenuAnchor(null);
                        openDeleteConfirmation('all', deleteMenuAnchor);
                    }}
                >
                    All occurrences
                </MenuItem>
            </Menu>
            <CompactPopover
                open={deleteConfirmationOpen}
                onClose={() => !deleting && setDeleteConfirmationOpen(false)}
                anchorPosition={deleteConfirmationAnchor ?? undefined}
                fullWidth={false}
                maxWidth={false}
                compactConfirmation
                slotProps={{
                    paper: {
                        sx: {
                            width: 'min(calc(100vw - 24px), 280px)',
                            maxWidth: 'min(calc(100vw - 24px), 280px)',
                            borderRadius: 1.5,
                        },
                    },
                }}
            >
                <DialogTitle sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: '0.9rem', lineHeight: 1.3 }}>
                    {deleteScope === 'occurrence' ? 'Delete this occurrence?' : 'Delete event?'}
                </DialogTitle>
                <DialogContent sx={{ px: 1.5, py: 0.5 }}>
                    <DialogContentText sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                        {deleteScope === 'occurrence'
                            ? 'This occurrence will be removed from your calendar. This cannot be undone.'
                            : event && recurrenceFrequency !== 'NONE'
                                ? 'All occurrences of this event will be removed from your calendar. This cannot be undone.'
                                : 'This event will be removed from your calendar. This cannot be undone.'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 1.25, pt: 0.5, pb: 1, gap: 0.5 }}>
                    <Button size="small" onClick={() => setDeleteConfirmationOpen(false)} disabled={deleting}>Keep</Button>
                    <Button size="small" color="error" variant="contained" onClick={() => void remove()} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </CompactPopover>
        </Box>
    );
}
