import React, {useEffect, useState} from 'react';
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    TextField,
} from '@mui/material';
import { useFormik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {Field} from "../interfaces/Field.tsx";

type props = {
    dialogTitle: string;
    dialogType: string;
    handleClose: (string) => void;
    fields: Field[];
    onSubmit: (string, values: Record<string, string>) => void;
    open: boolean;
}

export function DynamicFormDialog(props: props) {
    const [open, setOpen] = useState(props.open);
    const validationSchema = props.fields.reduce((acc, field) => {
        acc[field.name] = field.required
            ? Yup.string().required(`${field.label} is required`)
            : Yup.string();
        return acc;
    }, {} as Record<string, Yup.StringSchema>);

    const formik = useFormik({
        initialValues: props.fields.reduce((acc, field) =>
            ({ ...acc, [field.name]: '' }), {}),
        validationSchema: Yup.object(validationSchema),
        onSubmit: (values: Record<string, string>, { setSubmitting }:
            FormikHelpers<Record<string, string>>) => {
            console.log("Dialog type: " + props.dialogType)
            console.log(values)
            props.onSubmit(props.dialogType, values);
            setSubmitting(false);
            props.handleClose(props.dialogType);
        },
    });

    useEffect(() => {
        if (props.open !== open) {
            setOpen(props.open);
        }
    }, [props.open]);
    return (
        <Dialog open={open} onClose={props.handleClose}>
            <DialogTitle>{props.dialogTitle}</DialogTitle>
            <DialogContent>
                <form onSubmit={formik.handleSubmit}>
                    {props.fields.map((field) => (
                        <TextField
                            sx={{
                                "& .MuiInput-underline::before":
                                    formik.values[field.name] !== ""
                                        ? { borderBottomColor: "blue" }
                                        : { borderBottomColor: "grey" },
                            }}
                            key={field.name}
                            margin="dense"
                            name={field.name}
                            label={field.label}
                            type={field.type || 'text'}
                            placeholder={field.placeholder}
                            fullWidth
                            variant="standard"
                            value={formik.values[field.name]}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={formik.touched[field.name] && Boolean(formik.errors[field.name])}
                            helperText={formik.touched[field.name] && formik.errors[field.name]}
                        />
                    ))}
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {props.handleClose(props.dialogType)}}>Cancel</Button>
                <Button type="submit" onClick={() => formik.handleSubmit()}>Submit</Button>
            </DialogActions>
        </Dialog>
    );
}

