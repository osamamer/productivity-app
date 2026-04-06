import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box, TextField, Button, Select, MenuItem, FormControl,
    InputLabel, Typography, Stack, Collapse,
} from '@mui/material';
import { StatDefinition, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';

interface FormValues {
    name: string;
    description: string;
    type: StatType;
    minValue: string;
    maxValue: string;
}

const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    type: Yup.string().oneOf(['NUMBER', 'BOOLEAN', 'RANGE']).required(),
    minValue: Yup.string().when('type', {
        is: 'RANGE',
        then: schema => schema.required('Min value is required'),
        otherwise: schema => schema.optional(),
    }),
    maxValue: Yup.string().when('type', {
        is: 'RANGE',
        then: schema => schema
            .required('Max value is required')
            .test('gt-min', 'Max must be greater than min', function (maxStr) {
                const minStr = this.parent.minValue;
                if (!minStr || !maxStr) return true;
                return Number(maxStr) > Number(minStr);
            }),
        otherwise: schema => schema.optional(),
    }),
});

interface Props {
    onCreated: (def: StatDefinition) => void;
    onCancel: () => void;
}

export function CreateStatForm({ onCreated, onCancel }: Props) {
    const formik = useFormik<FormValues>({
        initialValues: { name: '', description: '', type: 'NUMBER', minValue: '', maxValue: '' },
        validationSchema,
        onSubmit: async (values, { setSubmitting, setFieldError }) => {
            try {
                const def = await statService.createDefinition({
                    name: values.name,
                    description: values.description || undefined,
                    type: values.type,
                    minValue: values.type === 'RANGE' ? Number(values.minValue) : undefined,
                    maxValue: values.type === 'RANGE' ? Number(values.maxValue) : undefined,
                });
                onCreated(def);
            } catch (e) {
                console.error('Failed to create stat definition:', e);
                setFieldError('name', 'Failed to create stat. Please try again.');
            } finally {
                setSubmitting(false);
            }
        },
    });

    return (
        <Box
            component="form"
            onSubmit={formik.handleSubmit}
            sx={{ p: 2.5, border: 1, borderColor: 'divider', borderRadius: 2, mb: 3 }}
        >
            <Typography variant="h6" gutterBottom>New Statistic</Typography>
            <Stack spacing={2}>
                <TextField
                    name="name"
                    label="Name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    error={formik.touched.name && Boolean(formik.errors.name)}
                    helperText={formik.touched.name && formik.errors.name}
                    size="small"
                    required
                />
                <TextField
                    name="description"
                    label="Description (optional)"
                    value={formik.values.description}
                    onChange={formik.handleChange}
                    size="small"
                    multiline
                    rows={2}
                />
                <FormControl size="small" required>
                    <InputLabel>Type</InputLabel>
                    <Select
                        name="type"
                        value={formik.values.type}
                        label="Type"
                        onChange={formik.handleChange}
                    >
                        <MenuItem value="NUMBER">Number — free-form numeric value</MenuItem>
                        <MenuItem value="BOOLEAN">Boolean — Yes / No</MenuItem>
                        <MenuItem value="RANGE">Range — number within min/max bounds</MenuItem>
                    </Select>
                </FormControl>
                <Collapse in={formik.values.type === 'RANGE'}>
                    <Stack direction="row" spacing={2}>
                        <TextField
                            name="minValue"
                            label="Min"
                            type="number"
                            value={formik.values.minValue}
                            onChange={formik.handleChange}
                            error={formik.touched.minValue && Boolean(formik.errors.minValue)}
                            helperText={formik.touched.minValue && formik.errors.minValue}
                            size="small"
                        />
                        <TextField
                            name="maxValue"
                            label="Max"
                            type="number"
                            value={formik.values.maxValue}
                            onChange={formik.handleChange}
                            error={formik.touched.maxValue && Boolean(formik.errors.maxValue)}
                            helperText={formik.touched.maxValue && formik.errors.maxValue}
                            size="small"
                        />
                    </Stack>
                </Collapse>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button onClick={onCancel} color="inherit" size="small">Cancel</Button>
                    <Button type="submit" variant="contained" size="small" disabled={formik.isSubmitting}>
                        Create
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}
