import { Box, IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

type PomodoroNumberFieldProps = {
    name: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
};

export function PomodoroNumberField({
    name,
    label,
    value,
    onChange,
    min = 1,
    max,
    disabled = false,
}: PomodoroNumberFieldProps) {
    const changeValue = (delta: number) => {
        const nextValue = value + delta;
        onChange(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, nextValue)));
    };

    return (
        <TextField
            name={name}
            label={label}
            type="number"
            autoComplete="off"
            size="small"
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            disabled={disabled}
            inputProps={{ min, max, inputMode: 'numeric', style: { textAlign: 'left' } }}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end" sx={{ height: '100%', maxHeight: 'none', ml: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', mr: -0.75 }}>
                            <Tooltip title={`Increase ${label}`} placement="right">
                                <span>
                                    <IconButton
                                        size="small"
                                        aria-label={`Increase ${label}`}
                                        onClick={() => changeValue(1)}
                                        disabled={disabled || (max !== undefined && value >= max)}
                                        sx={{ p: 0, borderRadius: 0.75, height: 16 }}
                                    >
                                        <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title={`Decrease ${label}`} placement="right">
                                <span>
                                    <IconButton
                                        size="small"
                                        aria-label={`Decrease ${label}`}
                                        onClick={() => changeValue(-1)}
                                        disabled={disabled || value <= min}
                                        sx={{ p: 0, borderRadius: 0.75, height: 16 }}
                                    >
                                        <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    </InputAdornment>
                ),
            }}
            sx={{
                '& input[type=number]': {
                    MozAppearance: 'textfield',
                },
                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                },
                '& .MuiInputAdornment-root .MuiIconButton-root': {
                    color: 'text.secondary',
                },
                '& .MuiInputAdornment-root .MuiIconButton-root:hover': {
                    color: 'primary.main',
                    backgroundColor: 'action.hover',
                },
            }}
        />
    );
}
