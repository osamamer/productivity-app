import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box, TextField, Button, Select, MenuItem, FormControl,
    InputLabel, Typography, Stack, Collapse, FormHelperText, Checkbox, FormControlLabel,
} from '@mui/material';
import { CreateDefinitionRequest, StatDefinition, StatMorality, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import {
    durationValueToMinutes,
    minutesToDurationValue,
    minutesToTimeValue,
    timeValueToMinutes,
} from '../../services/utils/statValues';
import { AppTimeField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';
import { DurationInput } from './DurationInput';
import { useKeyboardDelete } from '../../hooks/useKeyboardDelete';

interface FormValues {
    name: string;
    description: string;
    type: StatType;
    minValue: string;
    maxValue: string;
    morality: StatMorality;
    goodThreshold: string;
    createRecurringTask: boolean;
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
            const numericThreshold = type === 'TIME'
                ? timeValueToMinutes(threshold ?? '')
                : type === 'DURATION'
                    ? durationValueToMinutes(threshold ?? '')
                    : Number(threshold);
            if (!threshold || numericThreshold == null || !Number.isFinite(numericThreshold)) {
                return this.createError({ message: 'A threshold is required for a non-neutral stat' });
            }
            if (type === 'RANGE') {
                if (numericThreshold < Number(minValue) || numericThreshold > Number(maxValue)) {
                    return this.createError({ message: 'Threshold must be inside the stat range' });
                }
            }
            return true;
        },
    ),
});

interface Props {
    onCreated?: (def: StatDefinition, operationId?: string) => void;
    onCreatedOptimistically?: (def: StatDefinition, operationId: string) => void;
    onCreationFailed?: (operationId: string) => void;
    onUpdated?: (def: StatDefinition) => void;
    onDelete?: () => void;
    onCancel: () => void;
    initialDefinition?: StatDefinition;
}

export function CreateStatForm({
    onCreated,
    onCreatedOptimistically,
    onCreationFailed,
    onUpdated,
    onDelete,
    onCancel,
    initialDefinition,
}: Props) {
    const isEditing = Boolean(initialDefinition);
    const [disconnectError, setDisconnectError] = React.useState<string | null>(null);
    const [disconnecting, setDisconnecting] = React.useState(false);
    useKeyboardDelete({
        enabled: Boolean(onDelete) && isEditing && !initialDefinition?.systemKey,
        allowDialog: true,
        onDelete: () => onDelete?.(),
    });
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
                : initialDefinition.type === 'TIME'
                    ? minutesToTimeValue(initialDefinition.goodThreshold)
                    : initialDefinition.type === 'DURATION'
                        ? minutesToDurationValue(initialDefinition.goodThreshold)
                        : String(initialDefinition.goodThreshold),
            createRecurringTask: false,
        },
        validationSchema,
        onSubmit: async (values, { setSubmitting, setFieldError }) => {
            try {
                const threshold = values.type === 'TIME'
                    ? timeValueToMinutes(values.goodThreshold)
                    : values.type === 'DURATION'
                        ? durationValueToMinutes(values.goodThreshold)
                        : values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? Number(values.goodThreshold)
                            : undefined;
                if (initialDefinition) {
                    const def = await statService.updateDefinition(initialDefinition.id, {
                        name: values.name,
                        description: values.description || undefined,
                        morality: values.morality,
                        goodThreshold: values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? threshold ?? undefined
                            : undefined,
                    });
                    onUpdated?.(def);
                } else {
                    const request: CreateDefinitionRequest = {
                        name: values.name,
                        description: values.description || undefined,
                        type: values.type,
                        minValue: values.type === 'RANGE' ? Number(values.minValue) : undefined,
                        maxValue: values.type === 'RANGE' ? Number(values.maxValue) : undefined,
                        morality: values.morality,
                        goodThreshold: values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? threshold ?? undefined
                            : undefined,
                        createRecurringTask: values.type === 'BOOLEAN' && values.createRecurringTask,
                    };

                    if (request.createRecurringTask && onCreatedOptimistically && onCreationFailed) {
                        const operationId = `pending-stat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                        onCreatedOptimistically({
                            id: operationId,
                            name: request.name,
                            description: request.description,
                            type: request.type,
                            morality: request.morality,
                            minValue: request.minValue,
                            maxValue: request.maxValue,
                            goodThreshold: request.goodThreshold,
                            recurringTaskSeriesId: null,
                            displayOrder: Number.MAX_SAFE_INTEGER,
                            userId: '',
                        }, operationId);
                        onCancel();
                        void statService.createDefinition(request)
                            .then(def => onCreated?.(def, operationId))
                            .catch(error => {
                                console.error('Failed to create linked statistic:', error);
                                onCreationFailed(operationId);
                            });
                    } else {
                        const def = await statService.createDefinition(request);
                        onCreated?.(def);
                    }
                }
            } catch (e) {
                console.error(`Failed to ${isEditing ? 'update' : 'create'} stat definition:`, e);
                setFieldError('name', `Failed to ${isEditing ? 'update' : 'create'} stat. Please try again.`);
            } finally {
                setSubmitting(false);
            }
        },
    });

    const disconnectRecurringTask = async () => {
        if (!initialDefinition?.recurringTaskSeriesId || disconnecting) return;

        setDisconnecting(true);
        setDisconnectError(null);
        try {
            const definition = await statService.disconnectRecurringTask(initialDefinition.id);
            onUpdated?.(definition);
        } catch (error) {
            console.error('Failed to disconnect recurring task:', error);
            setDisconnectError('Could not disconnect the recurring task. Please try again.');
        } finally {
            setDisconnecting(false);
        }
    };

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
                            formik.setFieldValue('goodThreshold', '');
                            if (type === 'BOOLEAN') {
                                formik.setFieldValue('morality', 'NEUTRAL');
                            } else {
                                formik.setFieldValue('createRecurringTask', false);
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
                        onChange={event => {
                            const morality = event.target.value as StatMorality;
                            formik.setFieldValue('morality', morality);
                            if (morality === 'NEUTRAL') formik.setFieldValue('goodThreshold', '');
                        }}
                    >
                        <MenuItem value="GOOD">{formik.values.type === 'TIME' ? 'Good — earlier is better' : 'Good / positive — higher is better'}</MenuItem>
                        <MenuItem value="BAD">{formik.values.type === 'TIME' ? 'Bad — later is worse' : 'Bad / negative — lower is better'}</MenuItem>
                        <MenuItem value="NEUTRAL">Neutral</MenuItem>
                    </Select>
                </FormControl>
                <Collapse in={formik.values.type === 'RANGE'}>
                    <Stack direction="row" spacing={2}>
                        <AppNumberField
                            name="minValue"
                            autoComplete="off"
                            label="Min"
                            value={formik.values.minValue}
                            onChange={formik.handleChange}
                            onStepValueChange={value => void formik.setFieldValue('minValue', String(value))}
                            disabled={isEditing}
                            error={formik.touched.minValue && Boolean(formik.errors.minValue)}
                            helperText={formik.touched.minValue && formik.errors.minValue}
                            size="small"
                        />
                        <AppNumberField
                            name="maxValue"
                            autoComplete="off"
                            label="Max"
                            value={formik.values.maxValue}
                            onChange={formik.handleChange}
                            onStepValueChange={value => void formik.setFieldValue('maxValue', String(value))}
                            disabled={isEditing}
                            error={formik.touched.maxValue && Boolean(formik.errors.maxValue)}
                            helperText={formik.touched.maxValue && formik.errors.maxValue}
                            size="small"
                        />
                    </Stack>
                </Collapse>
                <Collapse in={formik.values.type !== 'BOOLEAN' && formik.values.morality !== 'NEUTRAL'}>
                    {formik.values.type === 'TIME' ? (
                        <AppTimeField
                            label="Good at or before"
                            value={formik.values.goodThreshold}
                            onChange={value => void formik.setFieldValue('goodThreshold', value)}
                            onBlur={() => void formik.setFieldTouched('goodThreshold', true)}
                            error={formik.touched.goodThreshold && Boolean(formik.errors.goodThreshold)}
                            helperText={formik.touched.goodThreshold && formik.errors.goodThreshold
                                ? formik.errors.goodThreshold
                                : 'Earlier times are treated as better.'}
                            minutesStep={1}
                            inputProps={{ 'aria-label': 'Good at or before' }}
                        />
                    ) : formik.values.type === 'DURATION' ? (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {formik.values.morality === 'BAD' ? 'Good at or below' : 'Good at or above'}
                            </Typography>
                            <DurationInput
                                value={durationValueToMinutes(formik.values.goodThreshold)}
                                onChange={value => void formik.setFieldValue(
                                    'goodThreshold',
                                    value == null ? '' : minutesToDurationValue(value),
                                )}
                                onBlur={() => void formik.setFieldTouched('goodThreshold', true)}
                            />
                            <FormHelperText
                                error={formik.touched.goodThreshold && Boolean(formik.errors.goodThreshold)}
                            >
                                {formik.touched.goodThreshold && formik.errors.goodThreshold
                                    ? formik.errors.goodThreshold
                                    : 'Set the duration that counts as good to record.'}
                            </FormHelperText>
                        </Box>
                    ) : (
                        <AppNumberField
                            name="goodThreshold"
                            autoComplete="off"
                            label={formik.values.morality === 'BAD' ? 'Good at or below' : 'Good at or above'}
                            value={formik.values.goodThreshold}
                            onChange={formik.handleChange}
                            onStepValueChange={value => void formik.setFieldValue('goodThreshold', String(value))}
                            onBlur={formik.handleBlur}
                            error={formik.touched.goodThreshold && Boolean(formik.errors.goodThreshold)}
                            helperText={formik.touched.goodThreshold && formik.errors.goodThreshold
                                ? formik.errors.goodThreshold
                                : formik.values.type === 'RANGE'
                                ? `Choose a value from ${formik.values.minValue || 'min'} to ${formik.values.maxValue || 'max'}`
                                : 'Values on this side of the threshold feel good to record'}
                            size="small"
                            step="any"
                        />
                    )}
                </Collapse>
                <Collapse in={!isEditing && formik.values.type === 'BOOLEAN'}>
                    <FormControlLabel
                        control={(
                            <Checkbox
                                name="createRecurringTask"
                                checked={formik.values.createRecurringTask}
                                onChange={formik.handleChange}
                            />
                        )}
                        label="Create a daily recurring task linked to this statistic"
                    />
                </Collapse>
                {isEditing && initialDefinition?.recurringTaskSeriesId && (
                    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                        <Button
                            type="button"
                            onClick={() => { void disconnectRecurringTask(); }}
                            color="error"
                            size="small"
                            disabled={disconnecting || formik.isSubmitting}
                        >
                            {disconnecting ? 'Disconnecting…' : 'Disconnect recurring task'}
                        </Button>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            This keeps the existing tasks and statistic entries; it only removes their link.
                        </Typography>
                        {disconnectError && (
                            <FormHelperText error>{disconnectError}</FormHelperText>
                        )}
                    </Box>
                )}
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                    {isEditing && !initialDefinition?.systemKey && (
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
