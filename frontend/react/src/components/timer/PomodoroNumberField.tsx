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
    return (
        <AppNumberField
            name={name}
            label={label}
            autoComplete="off"
            size="small"
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            onStepValueChange={onChange}
            disabled={disabled}
            min={min}
            max={max}
            inputProps={{ inputMode: 'numeric', style: { textAlign: 'left' } }}
        />
    );
}
