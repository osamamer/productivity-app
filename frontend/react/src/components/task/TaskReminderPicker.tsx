import { Box, MenuItem, TextField, Typography } from '@mui/material';

const TASK_REMINDER_OPTIONS = [
    { value: 5, label: '5 minutes before' },
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 1440, label: '1 day before' },
    { value: 10080, label: '1 week before' },
];

type Props = {
    value: number | null | undefined;
    disabled?: boolean;
    onChange: (value: number | null) => void;
};

export function TaskReminderPicker({ value, disabled = false, onChange }: Props) {
    const customValue = value != null && !TASK_REMINDER_OPTIONS.some(option => option.value === value)
        ? value
        : null;

    return (
        <Box sx={{ mt: 1.25 }}>
            <TextField
                select
                label="Remind me"
                value={value ?? ''}
                disabled={disabled}
                autoComplete="off"
                onMouseDown={event => event.stopPropagation()}
                onClick={event => event.stopPropagation()}
                onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
                SelectProps={{
                    MenuProps: {
                        onClick: event => event.stopPropagation(),
                    },
                }}
                fullWidth
            >
                <MenuItem value="">No reminder</MenuItem>
                {customValue !== null && (
                    <MenuItem value={customValue}>{customValue} minutes before</MenuItem>
                )}
                {TASK_REMINDER_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
            </TextField>
            {!disabled && value != null && typeof window !== 'undefined'
                && 'Notification' in window && Notification.permission === 'denied' && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                    Notifications are blocked in this browser's site settings.
                </Typography>
            )}
        </Box>
    );
}
