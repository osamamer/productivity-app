import type { MouseEvent } from 'react';
import { Box, IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';

type NumberFieldValue = number | string | null | undefined;

export type AppNumberFieldProps = Omit<TextFieldProps, 'type' | 'InputProps'> & {
    min?: number;
    max?: number;
    step?: number | 'any';
    value?: NumberFieldValue;
    onStepValueChange: (value: number) => void;
};

function decimalPlaces(value: number): number {
    const valueAsString = String(value);
    const decimalPart = valueAsString.split('.')[1];
    return decimalPart?.length ?? 0;
}

function roundedNumber(value: number, precision: number): number {
    return Number(value.toFixed(Math.min(precision, 12)));
}

function numericAttribute(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

/**
 * Keeps numeric input controls consistent across browsers while retaining a
 * real number input for keyboard, validation, and assistive-technology users.
 */
export function AppNumberField({
    min,
    max,
    step,
    value,
    onStepValueChange,
    inputProps,
    sx,
    disabled = false,
    label,
    ...textFieldProps
}: AppNumberFieldProps) {
    const inputMin = min ?? numericAttribute(inputProps?.min);
    const inputMax = max ?? numericAttribute(inputProps?.max);
    const inputStep = step ?? (inputProps?.step === 'any' ? 'any' : numericAttribute(inputProps?.step));
    const stepSize = typeof inputStep === 'number' && inputStep > 0 ? inputStep : 1;
    const currentValue = typeof value === 'number' ? value : Number(value);
    const hasCurrentValue = Number.isFinite(currentValue);
    const displayLabel = typeof label === 'string' ? label : 'value';

    const changeValue = (direction: 1 | -1) => {
        if (disabled) return;

        const baseValue = hasCurrentValue
            ? currentValue
            : direction > 0
                ? inputMin ?? 0
                : inputMax ?? inputMin ?? 0;
        const precision = Math.max(decimalPlaces(baseValue), decimalPlaces(stepSize));
        const nextValue = roundedNumber(baseValue + direction * stepSize, precision);
        const boundedValue = Math.min(inputMax ?? Number.POSITIVE_INFINITY, Math.max(inputMin ?? Number.NEGATIVE_INFINITY, nextValue));
        onStepValueChange(boundedValue);
    };

    const stopInputBlur = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const numberInputProps = {
        ...inputProps,
        ...(inputMin !== undefined ? { min: inputMin } : {}),
        ...(inputMax !== undefined ? { max: inputMax } : {}),
        step: inputStep ?? 1,
    };

    return (
        <TextField
            {...textFieldProps}
            label={label}
            type="number"
            value={value ?? ''}
            disabled={disabled}
            inputProps={numberInputProps}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end" sx={{ height: '100%', maxHeight: 'none', ml: 0 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                mr: -0.5,
                            }}
                        >
                            <IconButton
                                size="small"
                                disableRipple
                                disableFocusRipple
                                aria-label={`Increase ${displayLabel}`}
                                onMouseDown={stopInputBlur}
                                onClick={() => changeValue(1)}
                                disabled={disabled || (hasCurrentValue && inputMax !== undefined && currentValue >= inputMax)}
                                sx={{
                                    p: 0,
                                    width: 18,
                                    height: 15,
                                    borderRadius: 0,
                                    color: 'text.secondary',
                                    '&:hover, &:focus-visible, &:active': {
                                        color: 'text.secondary',
                                        backgroundColor: 'transparent',
                                    },
                                }}
                            >
                                <KeyboardArrowUpRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                disableRipple
                                disableFocusRipple
                                aria-label={`Decrease ${displayLabel}`}
                                onMouseDown={stopInputBlur}
                                onClick={() => changeValue(-1)}
                                disabled={disabled || (hasCurrentValue && inputMin !== undefined && currentValue <= inputMin)}
                                sx={{
                                    p: 0,
                                    width: 18,
                                    height: 15,
                                    borderRadius: 0,
                                    color: 'text.secondary',
                                    '&:hover, &:focus-visible, &:active': {
                                        color: 'text.secondary',
                                        backgroundColor: 'transparent',
                                    },
                                }}
                            >
                                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                    </InputAdornment>
                ),
            }}
            sx={[
                {
                    '& input[type=number]': {
                        MozAppearance: 'textfield',
                    },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                    },
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        />
    );
}
