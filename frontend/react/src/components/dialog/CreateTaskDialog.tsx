import React, {useEffect, useState} from "react";
import {DynamicFormDialog} from "./DynamicFormDialog.tsx";
import {Field} from "../../interfaces/Field.tsx";

const fields: Field[] =  [
    {name: "taskName", label: "", placeholder: "Task name", required: true},
    {name: "taskDescription", label: "", placeholder: "Task description"},
    {name: "taskPerformTime", label: "", placeholder: "Task scheduled time"},
    {name: "taskTag", label: "", placeholder: "Task tag"},
    {name: "taskImportance", label: "", placeholder: "Task importance"}
]
type props = {
    open: boolean;
    handleClose: (arg0: string) => void;
    onSubmit: (arg0: string, values: Record<string, string>) => void;
}
export function CreateTaskDialog(props: props) {
    const [open, setOpen] = useState(props.open);

    useEffect(() => {
        if (props.open !== open) {
            setOpen(props.open);
        }
    }, [props.open]);
    return (
        <DynamicFormDialog dialogTitle="Enter task information:"
                           open={open} handleClose={props.handleClose}
                           fields={fields} onSubmit={props.onSubmit} dialogType={"createTaskDialog"}>
        </DynamicFormDialog>
    );
}