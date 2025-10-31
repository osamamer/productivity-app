import React, {useEffect, useState} from "react";
import {DynamicFormDialog} from "./DynamicFormDialog.tsx";
import {Field} from "../../interfaces/Field.tsx";

const fields: Field[] =  [
    {name: "focusDuration", label: "", placeholder: "Focus duration (minutes)", required: true, type: "number", min:1, max:180},
    {name: "shortBreakDuration", label: "", placeholder: "Short break duration (minutes)", required: true, type: "number", min:1, max:15},
    {name: "longBreakDuration", label: "", placeholder: "Long break duration (minutes)", required: true, type: "number", min:1, max:45},
    {name: "numFocuses", label: "", placeholder: "Number of focus durations (minutes)", required: true, type: "number", min:1, max:12},
    {name: "longBreakCooldown", label: "", placeholder: "Long break every...?", required: true, type: "number", min:1, max:6},
]

type props = {
    open: boolean;
    handleClose: (dialogType: string) => void;
    onSubmit: (dialogType: string, values: Record<string, string>) => void;
}
export function PomodoroDialog(props: props) {
    const [open, setOpen] = useState(props.open);


    useEffect(() => {
        if (props.open !== open) {
            setOpen(props.open);
        }
    }, [props.open]);


    return (
        <DynamicFormDialog dialogTitle="Enter pomodoro information:"
                           open={open} handleClose={props.handleClose}
                           fields={fields} onSubmit={props.onSubmit} dialogType={"pomodoroDialog"}>
        </DynamicFormDialog>
    );
}