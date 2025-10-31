import React, {useEffect, useState} from 'react';
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    TextField, useTheme,
} from '@mui/material';
import { useFormik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {Field} from "../../interfaces/Field.tsx";
import {AnyObject, NumberSchema, StringSchema} from "yup";
type FormValues = Record<string, string | number>;
type props = {
    dialogTitle: string;
    dialogType: string;
    handleClose: (dialogType: string) => void;
    fields: Field[];
    onSubmit: (dialogType: string, values: Record<string, string>) => void;
    open: boolean;
}

export function DynamicFormDialog(props: props) {
    const theme = useTheme();
    const [open, setOpen] = useState(props.open);
    const validationSchema = props.fields.reduce((acc, field) => {
        if (field.type === 'number') {
            let schema: NumberSchema<number | undefined | null, AnyObject, undefined, ""> = Yup.number()
                .typeError(`${field.label} must be a number`);

            if (field.required) {
                schema = schema.required(`${field.label} is required`);
            } else {
                schema = schema.nullable();
            }

            if (field.min !== undefined) {
                schema = schema.min(field.min, `${field.label} must be at least ${field.min}`);
            }
            if (field.max !== undefined) {
                schema = schema.max(field.max, `${field.label} must be at most ${field.max}`);
            }

            acc[field.name] = schema;
        } else {
            let schema: StringSchema<string | undefined | null, AnyObject, undefined, ""> = Yup.string();

            if (field.required) {
                schema = schema.required(`${field.label} is required`);
            } else {
                schema = schema.nullable();
            }

            acc[field.name] = schema;
        }
        return acc;
    }, {} as Record<string, Yup.AnySchema>);

    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    const formik = useFormik<FormValues>({
        initialValues: props.fields.reduce((acc, field) =>
            ({ ...acc, [field.name]: '' }), {}),
        validationSchema: Yup.object(validationSchema),
        onSubmit: (values: Record<string, string>, { setSubmitting }:
            FormikHelpers<Record<string, string>>) => {
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
        <Dialog open={open} onClose={props.handleClose} sx={{minHeight: 800, minWidth: 800}}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault(); // avoid accidental form submits
                        formik.handleSubmit();
                    }
                }}>
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
                                flex: '1 0 auto'
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
                            inputProps={
                                field.type === 'number'
                                    ? {
                                        min: field.min ?? undefined,
                                        max: field.max ?? undefined,
                                        step: 1, // Or any step value you need
                                    }
                                    : {}
                            }
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

