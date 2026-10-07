import { useEffect, useState } from 'react';
import { AppNumberField } from '../input/AppNumberField';

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
    const [inputValue, setInputValue] = useState(String(value));
    const parsedInputValue = inputValue === '' ? null : Number(inputValue);
    const inputValueIsValid = parsedInputValue !== null
        && Number.isSafeInteger(parsedInputValue)
        && parsedInputValue >= min
        && (max === undefined || parsedInputValue <= max);
    const validationMessage = inputValue === '' || inputValueIsValid
        ? undefined
        : max === undefined
            ? `Enter a whole number of at least ${min}.`
            : `Enter a whole number from ${min} to ${max}.`;

    useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    return (
        <AppNumberField
            name={name}
            label={label}
            autoComplete="off"
            size="small"
            value={inputValue}
            onChange={event => {
                const nextValue = event.target.value;
                setInputValue(nextValue);
                const parsedValue = nextValue === '' ? null : Number(nextValue);
                if (parsedValue !== null
                    && Number.isSafeInteger(parsedValue)
                    && parsedValue >= min
                    && (max === undefined || parsedValue <= max)) {
                    onChange(parsedValue);
                }
            }}
            onStepValueChange={onChange}
            disabled={disabled}
            min={min}
            max={max}
            error={Boolean(validationMessage)}
            helperText={validationMessage}
            inputProps={{
                inputMode: 'numeric',
                style: { textAlign: 'left' },
                onFocus: event => event.currentTarget.select(),
                onClick: event => event.currentTarget.select(),
            }}
        />
    );
}
