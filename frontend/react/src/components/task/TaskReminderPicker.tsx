import { useRef, useState } from 'react';
import { Alert, Box, Button, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import { AppDateField, AppTimeField } from '../input/AppPickerFields';
import { formatReminderDateTime } from './taskReminderFormatting';

const TASK_REMINDER_OPTIONS = [
    { value: 5, label: '5 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 1440, label: '1 day before' },
];

const MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

type Props = {
    value: number | null | undefined;
    scheduledAt?: string | null;
    disabled?: boolean;
    targetLabel?: 'task' | 'event';
    onChange: (value: number | null) => void;
};

function localDateString(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function localClockString(value: Date): string {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function TaskReminderPicker({
    value,
    scheduledAt,
    disabled = false,
    targetLabel = 'task',
    onChange,
}: Props) {
    const [customReminderOpen, setCustomReminderOpen] = useState(false);
    const [customReminderDate, setCustomReminderDate] = useState('');
    const [customReminderTime, setCustomReminderTime] = useState('');
    const [customReminderError, setCustomReminderError] = useState<string | null>(null);
    const reminderFieldRef = useRef<HTMLDivElement | null>(null);
    const hasCustomReminder = value != null && !TASK_REMINDER_OPTIONS.some(option => option.value === value);
    const customReminderLabel = hasCustomReminder && value != null
        ? scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime())
            ? formatReminderDateTime(new Date(new Date(scheduledAt).getTime() - value * 60_000))
            : `${value} minutes before`
        : '';

    const openCustomReminder = () => {
        const taskDate = scheduledAt ? new Date(scheduledAt) : null;
        if (taskDate && !Number.isNaN(taskDate.getTime())) {
            const reminderDate = new Date(taskDate.getTime() - (value ?? 60) * 60_000);
            setCustomReminderDate(localDateString(reminderDate));
            setCustomReminderTime(localClockString(reminderDate));
        }
        setCustomReminderError(null);
        setCustomReminderOpen(true);
    };

    const confirmCustomReminder = () => {
        const taskDate = scheduledAt ? new Date(scheduledAt) : null;
        const reminderDate = new Date(`${customReminderDate}T${customReminderTime}:00`);
        if (!taskDate || Number.isNaN(taskDate.getTime()) || Number.isNaN(reminderDate.getTime())) {
            setCustomReminderError('Choose a valid reminder time.');
            return;
        }

        const minutesBefore = (taskDate.getTime() - reminderDate.getTime()) / 60_000;
        if (!Number.isInteger(minutesBefore) || minutesBefore < 0) {
            setCustomReminderError(`The reminder must be at or before the ${targetLabel}.`);
            return;
        }
        if (minutesBefore > MAX_REMINDER_MINUTES) {
            setCustomReminderError(`The reminder can be at most eight weeks before the ${targetLabel}.`);
            return;
        }

        setCustomReminderOpen(false);
        onChange(minutesBefore);
    };

    return (
        <Box sx={{ mt: 1.25 }}>
            <Box ref={reminderFieldRef}>
                <TextField
                    select
                    label="Remind me"
                    value={hasCustomReminder ? 'CUSTOM' : value ?? ''}
                    disabled={disabled}
                    size="small"
                    autoComplete="off"
                    onMouseDown={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    onChange={event => {
                        if (event.target.value === 'CUSTOM') {
                            openCustomReminder();
                            return;
                        }
                        onChange(event.target.value === '' ? null : Number(event.target.value));
                    }}
                    SelectProps={{
                        MenuProps: {
                            onClick: event => event.stopPropagation(),
                        },
                    }}
                    fullWidth
                >
                    <MenuItem value="">No reminder</MenuItem>
                    {TASK_REMINDER_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                    <MenuItem value="CUSTOM" disabled={disabled}>
                        {hasCustomReminder ? `Custom · ${customReminderLabel}` : 'Custom…'}
                    </MenuItem>
                </TextField>
            </Box>
            <Popover
                open={customReminderOpen}
                anchorEl={reminderFieldRef.current}
                onClose={event => {
                    const target = (event as { target?: EventTarget | null }).target;
                    if (target instanceof Element
                        && target.closest('.MuiPickersPopper-root, .MuiPickersLayout-root, .MuiDialog-root')) return;
                    setCustomReminderOpen(false);
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 300,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: '8px',
                        },
                    },
                }}
            >
                <Stack spacing={1.25} onClick={event => event.stopPropagation()}>
                    <Typography variant="subtitle2">Custom reminder</Typography>
                    <AppDateField label="Reminder date" value={customReminderDate} onChange={setCustomReminderDate} />
                    <AppTimeField label="Reminder time" value={customReminderTime} onChange={setCustomReminderTime} />
                    {customReminderError && <Alert severity="error">{customReminderError}</Alert>}
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button size="small" onClick={() => setCustomReminderOpen(false)}>Cancel</Button>
                        <Button size="small" variant="contained" onClick={confirmCustomReminder}>Set reminder</Button>
                    </Stack>
                </Stack>
            </Popover>
            {!disabled && value != null && typeof window !== 'undefined'
                && 'Notification' in window && Notification.permission === 'denied' && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                    Notifications are blocked in this browser's site settings.
                </Typography>
            )}
        </Box>
    );
}
