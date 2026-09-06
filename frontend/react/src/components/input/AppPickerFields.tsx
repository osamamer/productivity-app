import type { FocusEventHandler, ReactNode } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import type { SxProps, Theme } from '@mui/material/styles';

type PickerFieldProps = {
    label: string;
    helperText?: ReactNode;
    error?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    fullWidth?: boolean;
    size?: 'small' | 'medium';
    sx?: SxProps<Theme>;
    inputProps?: Record<string, unknown>;
    onFocus?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};

export type AppDateFieldProps = PickerFieldProps & {
    value: string;
    onChange: (value: string) => void;
};

export type AppTimeFieldProps = PickerFieldProps & {
    value: string;
    onChange: (value: string) => void;
    minutesStep?: number;
};

function parseDateOnly(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        ? date
        : null;
}

function formatDateOnly(value: Date | null): string {
    if (!value || Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseTime(value: string): Date | null {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (hours > 23 || minutes > 59) return null;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

function formatTime(value: Date | null): string {
    if (!value || Number.isNaN(value.getTime())) return '';
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function pickerPopperSx(theme: Theme) {
    return {
        '& .MuiPaper-root': {
            borderRadius: 3,
            backgroundImage: 'none',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[8],
            overflow: 'hidden',
        },
    };
}

function pickerTextFieldProps({
    helperText,
    error,
    disabled,
    readOnly,
    autoFocus,
    fullWidth = true,
    size = 'small',
    sx,
    inputProps,
    onFocus,
    onBlur,
}: Omit<PickerFieldProps, 'label'>) {
    return {
        fullWidth,
        size,
        helperText,
        error,
        disabled,
        autoFocus,
        sx,
        onFocus,
        onBlur,
        inputProps: {
            ...inputProps,
            readOnly,
        },
    };
}

export function AppDateField({ label, value, onChange, ...props }: AppDateFieldProps) {
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
                label={label}
                value={parseDateOnly(value)}
                onChange={date => onChange(formatDateOnly(date))}
                format="MMM d, yyyy"
                slotProps={{
                    field: { clearable: true },
                    textField: pickerTextFieldProps(props),
                    popper: { sx: pickerPopperSx },
                }}
            />
        </LocalizationProvider>
    );
}

export function AppTimeField({ label, value, onChange, minutesStep = 1, ...props }: AppTimeFieldProps) {
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TimePicker
                label={label}
                value={parseTime(value)}
                onChange={time => onChange(formatTime(time))}
                ampm={false}
                format="HH:mm"
                minutesStep={minutesStep}
                slotProps={{
                    field: { clearable: true },
                    textField: pickerTextFieldProps(props),
                    popper: { sx: pickerPopperSx },
                }}
            />
        </LocalizationProvider>
    );
}
