import React, {useEffect, useState} from "react";
import {DynamicFormDialog} from "./DynamicFormDialog.tsx";
import {Field} from "../../interfaces/Field.tsx";

const fields: Field[] =  [
    {name: "dayRating", label: "", placeholder: "Today out of 10?", type: "number", min: 0, max: 10},
    {name: "dayPlan", label: "", placeholder: "What's the plan?"},
    {name: "daySummary", label: "", placeholder: "What happened today?"}
]

type props = {
    open: boolean;
    handleClose: (dialogType: string) => void;
    onSubmit: (dialogType: string, values: Record<string, string>) => void;
}
export function DayDialog(props: props) {
    const [open, setOpen] = useState(props.open);


    useEffect(() => {
        if (props.open !== open) {
            setOpen(props.open);
        }
    }, [props.open]);

    return (
        <DynamicFormDialog dialogTitle="Enter day information:"
                           open={open} handleClose={props.handleClose}
                           fields={fields} onSubmit={props.onSubmit} dialogType={"dayDialog"}>
        </DynamicFormDialog>
    );
}