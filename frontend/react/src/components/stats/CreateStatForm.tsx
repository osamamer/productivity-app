import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box, TextField, Button, Select, MenuItem, FormControl,
    InputLabel, Typography, Stack, Collapse, FormHelperText,
} from '@mui/material';
import { StatDefinition, StatMorality, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';

interface FormValues {
    name: string;
    description: string;
    type: StatType;
    minValue: string;
    maxValue: string;
    morality: StatMorality;
    goodThreshold: string;
}

const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    type: Yup.string().oneOf(['NUMBER', 'BOOLEAN', 'RANGE', 'TIME', 'DURATION']).required(),
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
    morality: Yup.mixed<StatMorality>().oneOf(['GOOD', 'BAD', 'NEUTRAL']).required(),
    goodThreshold: Yup.string().test(
        'threshold',
        'A threshold is required for a non-neutral numeric stat',
        function (threshold) {
            const { type, morality, minValue, maxValue } = this.parent as FormValues;
            if (type === 'BOOLEAN' || morality === 'NEUTRAL') return true;
            if (!threshold || !Number.isFinite(Number(threshold))) {
                return this.createError({ message: 'A threshold is required for a non-neutral numeric stat' });
            }
            if (type === 'RANGE') {
                const numericThreshold = Number(threshold);
                if (numericThreshold < Number(minValue) || numericThreshold > Number(maxValue)) {
                    return this.createError({ message: 'Threshold must be inside the stat range' });
                }
            }
            return true;
        },
    ),
});

interface Props {
    onCreated?: (def: StatDefinition) => void;
    onUpdated?: (def: StatDefinition) => void;
    onDelete?: () => void;
    onCancel: () => void;
    initialDefinition?: StatDefinition;
}

export function CreateStatForm({ onCreated, onUpdated, onDelete, onCancel, initialDefinition }: Props) {
    const isEditing = Boolean(initialDefinition);
    const formik = useFormik<FormValues>({
        enableReinitialize: true,
        initialValues: {
            name: initialDefinition?.name ?? '',
            description: initialDefinition?.description ?? '',
            type: initialDefinition?.type ?? 'NUMBER',
            minValue: initialDefinition?.minValue == null ? '' : String(initialDefinition.minValue),
            maxValue: initialDefinition?.maxValue == null ? '' : String(initialDefinition.maxValue),
            morality: initialDefinition?.morality ?? 'NEUTRAL',
            goodThreshold: initialDefinition?.goodThreshold == null
                ? ''
                : String(initialDefinition.goodThreshold),
        },
        validationSchema,
        onSubmit: async (values, { setSubmitting, setFieldError }) => {
            try {
                if (initialDefinition) {
                    const def = await statService.updateDefinition(initialDefinition.id, {
                        name: values.name,
                        description: values.description || undefined,
                        morality: values.morality,
                        goodThreshold: values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? Number(values.goodThreshold)
                            : undefined,
                    });
                    onUpdated?.(def);
                } else {
                    const def = await statService.createDefinition({
                        name: values.name,
                        description: values.description || undefined,
                        type: values.type,
                        minValue: values.type === 'RANGE' ? Number(values.minValue) : undefined,
                        maxValue: values.type === 'RANGE' ? Number(values.maxValue) : undefined,
                        morality: values.morality,
                        goodThreshold: values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? Number(values.goodThreshold)
                            : undefined,
                    });
                    onCreated?.(def);
                }
            } catch (e) {
                console.error(`Failed to ${isEditing ? 'update' : 'create'} stat definition:`, e);
                setFieldError('name', `Failed to ${isEditing ? 'update' : 'create'} stat. Please try again.`);
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
            <Typography variant="h6" gutterBottom>{isEditing ? 'Edit Statistic' : 'New Statistic'}</Typography>
            <Stack spacing={2}>
                <TextField
                    name="name"
                    autoComplete="off"
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
                    autoComplete="off"
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
                        disabled={isEditing}
                        onChange={event => {
                            const type = event.target.value as StatType;
                            formik.setFieldValue('type', type);
                            if (type === 'BOOLEAN' || type === 'TIME') {
                                formik.setFieldValue('goodThreshold', '');
                                formik.setFieldValue('morality', 'NEUTRAL');
                            }
                        }}
                    >
                        <MenuItem value="NUMBER">Number — free-form numeric value</MenuItem>
                        <MenuItem value="BOOLEAN">Boolean — Yes / No</MenuItem>
                        <MenuItem value="RANGE">Range — number within min/max bounds</MenuItem>
                        <MenuItem value="TIME">Time — time of day</MenuItem>
                        <MenuItem value="DURATION">Duration — hours and minutes</MenuItem>
                    </Select>
                    {isEditing && (
                        <FormHelperText>Type and range bounds cannot be changed after creation.</FormHelperText>
                    )}
                </FormControl>
                <FormControl size="small">
                    <InputLabel>Morality</InputLabel>
                    <Select
                        name="morality"
                        value={formik.values.morality}
                        label="Morality"
                        disabled={formik.values.type === 'TIME'}
                        onChange={event => {
                            const morality = event.target.value as StatMorality;
                            formik.setFieldValue('morality', morality);
                            if (morality === 'NEUTRAL') formik.setFieldValue('goodThreshold', '');
                        }}
                    >
                        <MenuItem value="GOOD">Good / positive — higher is better</MenuItem>
                        <MenuItem value="BAD">Bad / negative — lower is better</MenuItem>
                        <MenuItem value="NEUTRAL">Neutral</MenuItem>
                    </Select>
                </FormControl>
                <Collapse in={formik.values.type === 'RANGE'}>
                    <Stack direction="row" spacing={2}>
                        <TextField
                            name="minValue"
                            autoComplete="off"
                            label="Min"
                            type="number"
                            value={formik.values.minValue}
                            onChange={formik.handleChange}
                            disabled={isEditing}
                            error={formik.touched.minValue && Boolean(formik.errors.minValue)}
                            helperText={formik.touched.minValue && formik.errors.minValue}
                            size="small"
                        />
                        <TextField
                            name="maxValue"
                            autoComplete="off"
                            label="Max"
                            type="number"
                            value={formik.values.maxValue}
                            onChange={formik.handleChange}
                            disabled={isEditing}
                            error={formik.touched.maxValue && Boolean(formik.errors.maxValue)}
                            helperText={formik.touched.maxValue && formik.errors.maxValue}
                            size="small"
                        />
                    </Stack>
                </Collapse>
                <Collapse in={formik.values.type !== 'BOOLEAN' && formik.values.morality !== 'NEUTRAL'}>
                    <TextField
                        name="goodThreshold"
                        autoComplete="off"
                        label={formik.values.morality === 'BAD' ? 'Good at or below' : 'Good at or above'}
                        type="number"
                        value={formik.values.goodThreshold}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.goodThreshold && Boolean(formik.errors.goodThreshold)}
                        helperText={formik.touched.goodThreshold && formik.errors.goodThreshold
                            ? formik.errors.goodThreshold
                            : formik.values.type === 'RANGE'
                            ? `Choose a value from ${formik.values.minValue || 'min'} to ${formik.values.maxValue || 'max'}`
                            : 'Values on this side of the threshold feel good to record'}
                        size="small"
                        inputProps={{ step: 'any' }}
                    />
                </Collapse>
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                    {isEditing && (
                        <Button type="button" onClick={onDelete} color="error" size="small">
                            Delete statistic
                        </Button>
                    )}
                    <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                        <Button onClick={onCancel} color="inherit" size="small">Cancel</Button>
                        <Button type="submit" variant="contained" size="small" disabled={formik.isSubmitting}>
                            {isEditing ? 'Save changes' : 'Create'}
                        </Button>
                    </Stack>
                </Stack>
            </Stack>
        </Box>
    );
}
