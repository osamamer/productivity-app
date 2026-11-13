import { CompactPopover } from '../CompactPopover';
import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Box, TextField, Button, Select,
    MenuItem, FormControl, InputLabel, Typography,
    Stack, Collapse, FormHelperText, Checkbox,
    FormControlLabel, FormGroup, DialogActions, DialogContent, DialogTitle,
} from '@mui/material';
import {
    CreateDefinitionRequest, StatDefinition, StatMorality, StatRecurrenceDay,
    StatRecurrenceFrequency, StatType,
} from '../../types/Stats';
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
import { StatRecurringTaskOptions } from './StatRecurringTaskDialog';
import { defaultStatRecurringTaskDraft } from './statRecurringTaskUtils';

interface FormValues {
    name: string;
    type: StatType;
    additionalInputTypes: StatType[];
    unit: string;
    minValue: string;
    maxValue: string;
    morality: StatMorality;
    goodThreshold: string;
    includeUnloggedDaysAsZero: boolean;
    createRecurringTask: boolean;
    recurrenceFrequency: StatRecurrenceFrequency;
    recurrenceDaysOfWeek: StatRecurrenceDay[];
    parentDefinitionId: string;
    timeOfDay: string;
    recurringTaskImportance: number;
}

function normalizedStatName(name: string): string {
    return name.trim().toLowerCase();
}

const additionalInputOptions: Array<{ type: StatType; label: string }> = [
    { type: 'BOOLEAN', label: 'Yes / no' },
    { type: 'NUMBER', label: 'Amount' },
    { type: 'RANGE', label: 'Rating (0–10)' },
    { type: 'TIME', label: 'Time' },
    { type: 'DURATION', label: 'Duration' },
];

const nonDailySystemKeys = new Set([
    'energy', 'activation', 'stimulation_hunger', 'clarity', 'valence', 'emotional_load',
    'stimulation', 'hunger', 'arousal',
]);

function supportsUnloggedDaysAsZero(type: StatType, systemKey?: string | null): boolean {
    return (type === 'NUMBER' || type === 'RANGE' || type === 'DURATION')
        && systemKey !== 'sleep_hours';
}

function createValidationSchema(existingDefinitions: StatDefinition[], currentDefinitionId?: string) {
    return Yup.object({
        name: Yup.string()
            .trim()
            .required('Name is required')
            .test('unique-name', 'A stat with that name already exists.', value => {
                if (!value?.trim()) return true;
                const normalizedName = normalizedStatName(value);
                return !existingDefinitions.some(definition =>
                    definition.id !== currentDefinitionId
                    && normalizedStatName(definition.name) === normalizedName,
                );
            }),
        type: Yup.string().oneOf(['NUMBER', 'BOOLEAN', 'RANGE', 'TIME', 'DURATION']).required(),
        unit: Yup.string().max(32, 'Use 32 characters or fewer.'),
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
        morality: Yup.mixed<StatMorality>().oneOf(['GOOD', 'BAD', 'NEUTRAL', 'NICE_TO_HAVE', 'NICE_TO_AVOID']).required(),
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
        timeOfDay: Yup.string().when('createRecurringTask', {
            is: true,
            then: schema => schema
                .required('Choose a task time.')
                .matches(/^\d{2}:\d{2}$/, 'Choose a task time.'),
            otherwise: schema => schema.optional(),
        }),
    });
}

interface Props {
    onCreated?: (def: StatDefinition, operationId?: string) => void;
    onCreatedOptimistically?: (def: StatDefinition, operationId: string) => void;
    onCreationFailed?: (operationId: string) => void;
    onUpdated?: (def: StatDefinition, operationId?: string) => void;
    onUpdatedOptimistically?: (def: StatDefinition, operationId: string, previous: StatDefinition) => void;
    onUpdateFailed?: (operationId: string, previous: StatDefinition) => void;
    onCreateRecurringTask?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onEditRecurringTask?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onDelete?: (anchor?: HTMLElement) => void;
    onCancel: () => void;
    initialDefinition?: StatDefinition;
    existingDefinitions?: StatDefinition[];
}

export function CreateStatForm({
    onCreated,
    onCreatedOptimistically,
    onCreationFailed,
    onUpdated,
    onUpdatedOptimistically,
    onUpdateFailed,
    onCreateRecurringTask,
    onEditRecurringTask,
    onDelete,
    onCancel,
    initialDefinition,
    existingDefinitions = [],
}: Props) {
    const isEditing = Boolean(initialDefinition);
    const hasRecurringTask = Boolean(initialDefinition?.recurringTaskSeriesId);
    const parentCandidates = existingDefinitions.filter(definition =>
        !definition.parentDefinitionId && !nonDailySystemKeys.has(definition.systemKey ?? ''),
    );
    const currentDefinitionHasChildren = Boolean(initialDefinition && existingDefinitions.some(
        definition => definition.parentDefinitionId === initialDefinition.id,
    ));
    // Keep the clock-based default stable so enableReinitialize cannot reset
    // user-entered fields when a later render crosses into a new minute.
    const [initialRecurringTaskDraft] = React.useState(defaultStatRecurringTaskDraft);
    const validationSchema = React.useMemo(
        () => createValidationSchema(existingDefinitions, initialDefinition?.id),
        [existingDefinitions, initialDefinition?.id],
    );
    const [disconnectError, setDisconnectError] = React.useState<string | null>(null);
    const [disconnecting, setDisconnecting] = React.useState(false);
    const [deleteRecurringTaskOpen, setDeleteRecurringTaskOpen] = React.useState(false);
    const [deletingRecurringTask, setDeletingRecurringTask] = React.useState(false);
    useKeyboardDelete({
        enabled: Boolean(onDelete) && isEditing && !initialDefinition?.systemKey,
        allowDialog: true,
        onDelete: () => onDelete?.(),
    });
    const formik = useFormik<FormValues>({
        enableReinitialize: true,
        initialValues: {
            name: initialDefinition?.name ?? '',
            type: initialDefinition?.type ?? 'NUMBER',
            additionalInputTypes: initialDefinition?.additionalInputTypes ?? [],
            unit: initialDefinition?.unit ?? '',
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
            includeUnloggedDaysAsZero: initialDefinition?.includeUnloggedDaysAsZero ?? false,
            createRecurringTask: false,
            recurrenceFrequency: initialRecurringTaskDraft.recurrenceFrequency,
            recurrenceDaysOfWeek: initialRecurringTaskDraft.recurrenceDaysOfWeek,
            parentDefinitionId: initialDefinition?.parentDefinitionId ?? '',
            timeOfDay: initialRecurringTaskDraft.timeOfDay,
            recurringTaskImportance: initialRecurringTaskDraft.importance,
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
                    const hasAmountInput = values.type === 'NUMBER' || values.additionalInputTypes.includes('NUMBER');
                    const request = {
                        name: values.name.trim(),
                        morality: values.morality,
                        goodThreshold: values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? threshold ?? undefined
                            : undefined,
                        additionalInputTypes: values.additionalInputTypes.filter(type => type !== values.type),
                        unit: hasAmountInput ? values.unit.trim() : '',
                        parentDefinitionId: values.parentDefinitionId || null,
                        includeUnloggedDaysAsZero: supportsUnloggedDaysAsZero(
                            values.type,
                            initialDefinition.systemKey,
                        ) && values.includeUnloggedDaysAsZero,
                    };
                    if (onUpdatedOptimistically && onUpdateFailed) {
                        const operationId = `stat-update-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                        const optimisticDefinition: StatDefinition = {
                            ...initialDefinition,
                            ...request,
                            morality: request.morality,
                            goodThreshold: request.goodThreshold ?? null,
                            additionalInputTypes: request.additionalInputTypes,
                            unit: request.unit || null,
                            parentDefinitionId: request.parentDefinitionId ?? null,
                            includeUnloggedDaysAsZero: request.includeUnloggedDaysAsZero,
                        };
                        onUpdatedOptimistically(optimisticDefinition, operationId, initialDefinition);
                        onCancel();
                        void statService.updateDefinition(initialDefinition.id, request)
                            .then(def => onUpdated?.(def, operationId))
                            .catch(error => {
                                console.error('Failed to update stat definition:', error);
                                onUpdateFailed(operationId, initialDefinition);
                            });
                    } else {
                        const def = await statService.updateDefinition(initialDefinition.id, request);
                        onUpdated?.(def);
                    }
                } else {
                    const hasAmountInput = values.type === 'NUMBER' || values.additionalInputTypes.includes('NUMBER');
                    const request: CreateDefinitionRequest = {
                        name: values.name.trim(),
                        type: values.type,
                        additionalInputTypes: values.additionalInputTypes.filter(type => type !== values.type),
                        unit: hasAmountInput ? values.unit.trim() : undefined,
                        minValue: values.type === 'RANGE' ? Number(values.minValue) : undefined,
                        maxValue: values.type === 'RANGE' ? Number(values.maxValue) : undefined,
                        morality: values.morality,
                        goodThreshold: values.type !== 'BOOLEAN' && values.morality !== 'NEUTRAL'
                            ? threshold ?? undefined
                            : undefined,
                        createRecurringTask: values.type === 'BOOLEAN' && values.createRecurringTask,
                        recurrenceFrequency: values.recurrenceFrequency,
                        recurrenceDaysOfWeek: values.recurrenceDaysOfWeek,
                        timeOfDay: values.timeOfDay,
                        recurringTaskImportance: values.recurringTaskImportance,
                        parentDefinitionId: values.parentDefinitionId || null,
                        includeUnloggedDaysAsZero: supportsUnloggedDaysAsZero(values.type)
                            && values.includeUnloggedDaysAsZero,
                    };

                    if (request.createRecurringTask
                        && request.recurrenceFrequency === 'CUSTOM'
                        && request.recurrenceDaysOfWeek?.length === 0) {
                        setFieldError('recurrenceDaysOfWeek', 'Choose at least one day.');
                        return;
                    }

                    if (onCreatedOptimistically && onCreationFailed) {
                        const operationId = `pending-stat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                        const optimisticRecurringTaskSeriesId = request.createRecurringTask
                            ? `optimistic-series-${Date.now()}-${Math.random().toString(36).slice(2)}`
                            : null;
                        onCreatedOptimistically({
                            id: operationId,
                            name: request.name,
                            type: request.type,
                            additionalInputTypes: request.additionalInputTypes,
                            parentDefinitionId: request.parentDefinitionId ?? null,
                            unit: request.unit || null,
                            morality: request.morality,
                            minValue: request.minValue,
                            maxValue: request.maxValue,
                            goodThreshold: request.goodThreshold,
                            includeUnloggedDaysAsZero: request.includeUnloggedDaysAsZero,
                            recurringTaskSeriesId: optimisticRecurringTaskSeriesId,
                            focusTaskName: request.createRecurringTask ? request.name : null,
                            focusTaskNames: request.createRecurringTask ? [request.name] : [],
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
        const previousDefinition = initialDefinition;
        const optimisticDefinition: StatDefinition = {
            ...previousDefinition,
            recurringTaskSeriesId: null,
        };
        const operationId = `stat-recurring-disconnect-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (onUpdatedOptimistically && onUpdateFailed) {
            onUpdatedOptimistically(optimisticDefinition, operationId, previousDefinition);
            setDeleteRecurringTaskOpen(false);
            onCancel();
            void statService.disconnectRecurringTask(initialDefinition.id)
                .then(definition => onUpdated?.(definition, operationId))
                .catch(error => {
                    console.error('Failed to disconnect recurring task:', error);
                    onUpdateFailed(operationId, previousDefinition);
                });
            setDisconnecting(false);
            return;
        }
        try {
            const definition = await statService.disconnectRecurringTask(initialDefinition.id);
            setDeleteRecurringTaskOpen(false);
            onUpdated?.(definition);
        } catch (error) {
            console.error('Failed to disconnect recurring task:', error);
            setDisconnectError('Could not disconnect the recurring task. Please try again.');
        } finally {
            setDisconnecting(false);
        }
    };

    const deleteRecurringTaskSeries = async () => {
        if (!initialDefinition?.recurringTaskSeriesId || deletingRecurringTask) return;

        setDeletingRecurringTask(true);
        setDisconnectError(null);
        const previousDefinition = initialDefinition;
        const optimisticDefinition: StatDefinition = {
            ...previousDefinition,
            recurringTaskSeriesId: null,
        };
        const operationId = `stat-recurring-delete-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (onUpdatedOptimistically && onUpdateFailed) {
            onUpdatedOptimistically(optimisticDefinition, operationId, previousDefinition);
            setDeleteRecurringTaskOpen(false);
            onCancel();
            void statService.deleteRecurringTaskSeries(initialDefinition.id)
                .then(definition => onUpdated?.(definition, operationId))
                .catch(error => {
                    console.error('Failed to delete recurring task series:', error);
                    onUpdateFailed(operationId, previousDefinition);
                });
            setDeletingRecurringTask(false);
            return;
        }
        try {
            const definition = await statService.deleteRecurringTaskSeries(initialDefinition.id);
            setDeleteRecurringTaskOpen(false);
            onUpdated?.(definition);
        } catch (error) {
            console.error('Failed to delete recurring task series:', error);
            setDisconnectError('Could not delete the recurring task series. Please try again.');
        } finally {
            setDeletingRecurringTask(false);
        }
    };

    const deleteFutureRecurringTasks = async () => {
        if (!initialDefinition?.recurringTaskSeriesId || deletingRecurringTask) return;

        setDeletingRecurringTask(true);
        setDisconnectError(null);
        const previousDefinition = initialDefinition;
        const optimisticDefinition: StatDefinition = {
            ...previousDefinition,
            recurringTaskSeriesId: null,
        };
        const operationId = `stat-recurring-future-delete-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (onUpdatedOptimistically && onUpdateFailed) {
            onUpdatedOptimistically(optimisticDefinition, operationId, previousDefinition);
            setDeleteRecurringTaskOpen(false);
            onCancel();
            void statService.deleteRecurringTaskFutureOccurrences(initialDefinition.id)
                .then(definition => onUpdated?.(definition, operationId))
                .catch(error => {
                    console.error('Failed to delete future recurring stat tasks:', error);
                    onUpdateFailed(operationId, previousDefinition);
                });
            setDeletingRecurringTask(false);
            return;
        }
        try {
            const definition = await statService.deleteRecurringTaskFutureOccurrences(initialDefinition.id);
            setDeleteRecurringTaskOpen(false);
            onUpdated?.(definition);
        } catch (error) {
            console.error('Failed to delete future recurring stat tasks:', error);
            setDisconnectError('Could not delete future recurring tasks. Please try again.');
        } finally {
            setDeletingRecurringTask(false);
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
                    error={Boolean(formik.errors.name)}
                    helperText={formik.errors.name}
                    size="small"
                    required
                />
                <FormControl size="small" fullWidth disabled={Boolean(
                    isEditing && currentDefinitionHasChildren && !initialDefinition?.parentDefinitionId
                )}>
                    <InputLabel id="stat-parent-definition-label">Sub-stat of</InputLabel>
                    <Select
                        labelId="stat-parent-definition-label"
                        name="parentDefinitionId"
                        value={formik.values.parentDefinitionId}
                        label="Sub-stat of"
                        onChange={event => void formik.setFieldValue('parentDefinitionId', event.target.value)}
                    >
                        <MenuItem value="">None</MenuItem>
                        {formik.values.parentDefinitionId
                            && !parentCandidates.some(definition => definition.id === formik.values.parentDefinitionId)
                            && <MenuItem value={formik.values.parentDefinitionId} disabled>Linked statistic</MenuItem>}
                        {parentCandidates
                            .filter(definition => definition.id !== initialDefinition?.id)
                            .map(definition => (
                                <MenuItem key={definition.id} value={definition.id}>{definition.name}</MenuItem>
                            ))}
                    </Select>
                    <FormHelperText>
                        {isEditing && currentDefinitionHasChildren && !initialDefinition?.parentDefinitionId
                            ? 'Move or remove this statistic’s sub-stats first.'
                            : 'Choose a parent to keep this statistic with related tracking.'}
                    </FormHelperText>
                </FormControl>
                {!isEditing && <FormControl size="small" required>
                    <InputLabel>Type</InputLabel>
                    <Select
                        name="type"
                        value={formik.values.type}
                        label="Type"
                        onChange={event => {
                            const type = event.target.value as StatType;
                            formik.setFieldValue('type', type);
                            formik.setFieldValue('additionalInputTypes',
                                formik.values.additionalInputTypes.filter(inputType => inputType !== type));
                            formik.setFieldValue('goodThreshold', '');
                            if (type === 'BOOLEAN'
                                || formik.values.morality === 'NICE_TO_HAVE'
                                || formik.values.morality === 'NICE_TO_AVOID') {
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
                </FormControl>}
                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Additional inputs</Typography>
                    <FormGroup row>
                        {additionalInputOptions.filter(option => option.type !== formik.values.type).map(option => (
                            <FormControlLabel
                                key={option.type}
                                label={option.label}
                                control={(
                                    <Checkbox
                                        size="small"
                                        checked={formik.values.additionalInputTypes.includes(option.type)}
                                        onChange={event => {
                                            const selected = new Set(formik.values.additionalInputTypes);
                                            if (event.target.checked) selected.add(option.type);
                                            else selected.delete(option.type);
                                            void formik.setFieldValue('additionalInputTypes', Array.from(selected));
                                        }}
                                    />
                                )}
                            />
                        ))}
                    </FormGroup>
                    {formik.values.additionalInputTypes.includes('RANGE') && formik.values.type !== 'RANGE' && (
                        <Typography variant="caption" color="text.secondary">
                            Additional rating inputs use a 0–10 scale.
                        </Typography>
                    )}
                </Box>
                <Collapse in={supportsUnloggedDaysAsZero(formik.values.type, initialDefinition?.systemKey)} unmountOnExit>
                    <Box>
                        <FormControlLabel
                            control={(
                                <Checkbox
                                    name="includeUnloggedDaysAsZero"
                                    size="small"
                                    checked={formik.values.includeUnloggedDaysAsZero}
                                    onChange={formik.handleChange}
                                />
                            )}
                            label="Count unlogged days as zero"
                        />
                        <FormHelperText sx={{ ml: 4 }}>
                            Include days without a value in this statistic’s average, starting with its first logged day.
                        </FormHelperText>
                    </Box>
                </Collapse>
                {(formik.values.type === 'NUMBER' || formik.values.additionalInputTypes.includes('NUMBER')) && (
                    <TextField
                        name="unit"
                        autoComplete="off"
                        label="Unit"
                        placeholder="e.g. steps, kg, ml"
                        value={formik.values.unit}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.unit && Boolean(formik.errors.unit)}
                        helperText={formik.touched.unit ? formik.errors.unit : undefined}
                        size="small"
                        inputProps={{ maxLength: 32 }}
                    />
                )}
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
                        <MenuItem value="GOOD">{formik.values.type === 'BOOLEAN'
                            ? 'A must'
                            : formik.values.type === 'TIME' ? 'Earlier is better' : 'Higher is better'}</MenuItem>
                        <MenuItem value="BAD">{formik.values.type === 'BOOLEAN'
                            ? 'A must-avoid'
                            : formik.values.type === 'TIME' ? 'Later is better' : 'Lower is better'}</MenuItem>
                        {formik.values.type === 'BOOLEAN' ? [
                            <MenuItem key="NICE_TO_HAVE" value="NICE_TO_HAVE">Nice to have</MenuItem>,
                            <MenuItem key="NICE_TO_AVOID" value="NICE_TO_AVOID">Nice to avoid</MenuItem>,
                        ] : null}
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
                <Collapse
                    in={formik.values.type !== 'BOOLEAN' && formik.values.morality !== 'NEUTRAL'}
                    unmountOnExit
                >
                    {formik.values.type === 'TIME' ? (
                        <AppTimeField
                            label="Time threshold"
                            value={formik.values.goodThreshold}
                            onChange={value => void formik.setFieldValue('goodThreshold', value)}
                            onBlur={() => void formik.setFieldTouched('goodThreshold', true)}
                            error={formik.touched.goodThreshold && Boolean(formik.errors.goodThreshold)}
                            helperText={formik.touched.goodThreshold && formik.errors.goodThreshold
                                ? formik.errors.goodThreshold
                                : 'Earlier times are treated as better.'}
                            minutesStep={1}
                            inputProps={{ 'aria-label': 'Time threshold' }}
                        />
                    ) : formik.values.type === 'DURATION' ? (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {formik.values.morality === 'BAD' ? 'Threshold at or below' : 'Threshold at or above'}
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
                                    : 'Set your preferred duration threshold.'}
                            </FormHelperText>
                        </Box>
                    ) : (
                        <AppNumberField
                            name="goodThreshold"
                            autoComplete="off"
                            label={formik.values.morality === 'BAD' ? 'Threshold at or below' : 'Threshold at or above'}
                            value={formik.values.goodThreshold}
                            onChange={formik.handleChange}
                            onStepValueChange={value => void formik.setFieldValue('goodThreshold', String(value))}
                            onBlur={formik.handleBlur}
                            error={formik.touched.goodThreshold && Boolean(formik.errors.goodThreshold)}
                            helperText={formik.touched.goodThreshold && formik.errors.goodThreshold
                                ? formik.errors.goodThreshold
                                : formik.values.type === 'RANGE'
                                ? `Choose a value from ${formik.values.minValue || 'min'} to ${formik.values.maxValue || 'max'}`
                                : 'Values meeting this threshold match your preference.'}
                            size="small"
                            step="any"
                        />
                    )}
                </Collapse>
                <Collapse in={!isEditing && formik.values.type === 'BOOLEAN'} unmountOnExit>
                    <FormControlLabel
                        control={(
                            <Checkbox
                                name="createRecurringTask"
                                checked={formik.values.createRecurringTask}
                                onChange={formik.handleChange}
                            />
                        )}
                        label="Create a recurring task linked to this statistic"
                    />
                </Collapse>
                <Collapse
                    in={!isEditing && formik.values.type === 'BOOLEAN' && formik.values.createRecurringTask}
                    unmountOnExit
                >
                        <StatRecurringTaskOptions
                            value={{
                                recurrenceFrequency: formik.values.recurrenceFrequency,
                                recurrenceDaysOfWeek: formik.values.recurrenceDaysOfWeek,
                                timeOfDay: formik.values.timeOfDay,
                                importance: formik.values.recurringTaskImportance,
                            }}
                        onChange={value => {
                            void formik.setFieldValue('recurrenceFrequency', value.recurrenceFrequency);
                            void formik.setFieldValue('recurrenceDaysOfWeek', value.recurrenceDaysOfWeek);
                            void formik.setFieldValue('timeOfDay', value.timeOfDay);
                            void formik.setFieldValue('recurringTaskImportance', value.importance);
                        }}
                        timeError={formik.touched.timeOfDay ? formik.errors.timeOfDay : undefined}
                        disabled={formik.isSubmitting}
                    />
                    {formik.values.recurrenceFrequency === 'CUSTOM'
                        && formik.values.recurrenceDaysOfWeek.length === 0 && (
                        <FormHelperText error>Choose at least one day.</FormHelperText>
                    )}
                </Collapse>
                {isEditing && hasRecurringTask && (
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
                        <Typography variant="subtitle2">Recurring tasks</Typography>
                        <Stack spacing={0.5} alignItems="flex-start">
                            <Button
                                type="button"
                                onClick={() => {
                                    setDisconnectError(null);
                                    setDeleteRecurringTaskOpen(true);
                                }}
                                color="error"
                                variant="outlined"
                                size="small"
                                disabled={disconnecting || deletingRecurringTask || formik.isSubmitting}
                            >
                                Remove recurring tasks
                            </Button>
                            <Button
                                type="button"
                                onClick={onEditRecurringTask}
                                variant="outlined"
                                size="small"
                                disabled={disconnecting || deletingRecurringTask || formik.isSubmitting || !onEditRecurringTask}
                            >
                                Change schedule
                            </Button>
                        </Stack>
                        {disconnectError && (
                            <FormHelperText error>{disconnectError}</FormHelperText>
                        )}
                    </Box>
                )}
                {isEditing && initialDefinition?.type === 'BOOLEAN' && !initialDefinition.recurringTaskSeriesId && (
                    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                        <Button
                            type="button"
                            onClick={onCreateRecurringTask}
                            size="small"
                            disabled={formik.isSubmitting || !onCreateRecurringTask}
                        >
                            Create recurring task
                        </Button>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            Creates a recurring task linked to this statistic.
                        </Typography>
                    </Box>
                )}
                <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="space-between"
                    alignItems="center"
                    sx={hasRecurringTask ? { borderTop: 1, borderColor: 'divider', pt: 1.5 } : undefined}
                >
                    {isEditing && !initialDefinition?.systemKey && (
                        <Button type="button" onClick={event => onDelete?.(event.currentTarget)} color="error" size="small">
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
            <CompactPopover
                open={deleteRecurringTaskOpen}
                onClose={() => {
                    if (!deletingRecurringTask && !disconnecting) setDeleteRecurringTaskOpen(false);
                }}
                maxWidth="xs"
            >
                <DialogTitle>Remove recurring tasks?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Delete upcoming tasks and stop the schedule, while keeping past tasks. You can also disconnect
                        the schedule or delete the whole series.
                    </Typography>
                    {disconnectError && <FormHelperText error sx={{ mt: 1 }}>{disconnectError}</FormHelperText>}
                </DialogContent>
                <DialogActions sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <Button
                        onClick={() => setDeleteRecurringTaskOpen(false)}
                        disabled={deletingRecurringTask || disconnecting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => { void disconnectRecurringTask(); }}
                        disabled={deletingRecurringTask || disconnecting}
                    >
                        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </Button>
                    <Button
                        color="error"
                        variant="outlined"
                        onClick={() => { void deleteFutureRecurringTasks(); }}
                        disabled={deletingRecurringTask || disconnecting}
                    >
                        {deletingRecurringTask ? 'Deleting…' : 'Delete future tasks'}
                    </Button>
                    <Button
                        color="error"
                        onClick={() => { void deleteRecurringTaskSeries(); }}
                        disabled={deletingRecurringTask || disconnecting}
                    >
                        {deletingRecurringTask ? 'Deleting…' : 'Delete series'}
                    </Button>
                </DialogActions>
            </CompactPopover>
        </Box>
    );
}
