import { createContext, useContext, useMemo, useRef } from 'react';
import type { FocusEvent } from 'react';
import { Button, DialogActions } from '@mui/material';
import { usePickerContext } from '@mui/x-date-pickers/hooks';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import type { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';

type Props = {
    label: string;
    value: Date | null;
    savedValue: Date | null;
    timeOnly: boolean;
    disabled?: boolean;
    onChange: (value: Date | null) => void;
    onAccept: (value: Date | null) => void | Promise<void>;
};

type SchedulePickerActions = {
    accept: () => void;
    cancel: () => void;
};

const SchedulePickerActionsContext = createContext<SchedulePickerActions | null>(null);

function SchedulePickerActionBar(props: PickersActionBarProps) {
    const actions = useContext(SchedulePickerActionsContext);
    const { acceptValueChanges, cancelValueChanges } = usePickerContext<Date | null>();
    if (!actions) return null;

    const dialogActionsProps = { ...props };
    delete dialogActionsProps.actions;
    return (
        <DialogActions {...dialogActionsProps}>
            <Button onClick={() => {
                cancelValueChanges();
                actions.cancel();
            }}>Cancel</Button>
            <Button onClick={() => {
                acceptValueChanges();
                actions.accept();
            }}>Accept</Button>
        </DialogActions>
    );
}

export function TaskSchedulePicker({
    label,
    value,
    savedValue,
    timeOnly,
    disabled = false,
    onChange,
    onAccept,
}: Props) {
    const pickerOpenRef = useRef(false);
    const currentValueRef = useRef(value);
    currentValueRef.current = value;
    const actions = useMemo(() => ({
        accept: () => { void onAccept(currentValueRef.current); },
        cancel: () => onChange(savedValue),
    }), [onAccept, onChange, savedValue]);
    const handleFieldBlur = (event: FocusEvent<HTMLElement>) => {
        const fieldRoot = event.currentTarget.closest('.MuiPickersTextField-root');
        window.setTimeout(() => {
            if (pickerOpenRef.current || (fieldRoot && fieldRoot.contains(document.activeElement))) return;
            void onAccept(currentValueRef.current);
        }, 0);
    };
    const actionBar = { actions: ['cancel', 'accept'] as ('cancel' | 'accept')[] };

    const pickerActionSlots = { actionBar: SchedulePickerActionBar };
    const pickerActionSlotProps = {
        actionBar,
        field: { onBlur: handleFieldBlur },
    };

    if (timeOnly) {
        return (
            <SchedulePickerActionsContext.Provider value={actions}>
                <TimePicker
                    label={label}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    closeOnSelect={false}
                    ampm={false}
                    slots={pickerActionSlots}
                    slotProps={{
                        ...pickerActionSlotProps,
                        field: { ...pickerActionSlotProps.field, clearable: false },
                        textField: { size: 'small', fullWidth: true },
                    }}
                    onOpen={() => { pickerOpenRef.current = true; }}
                    onClose={() => { pickerOpenRef.current = false; }}
                />
            </SchedulePickerActionsContext.Provider>
        );
    }

    return (
        <SchedulePickerActionsContext.Provider value={actions}>
            <DateTimePicker
                label={label}
                value={value}
                onChange={onChange}
                disabled={disabled}
                closeOnSelect={false}
                ampm={false}
                slots={pickerActionSlots}
                slotProps={{
                    ...pickerActionSlotProps,
                    field: { ...pickerActionSlotProps.field, clearable: true },
                    textField: { size: 'small', fullWidth: true },
                }}
                onOpen={() => { pickerOpenRef.current = true; }}
                onClose={() => { pickerOpenRef.current = false; }}
            />
        </SchedulePickerActionsContext.Provider>
    );
}
