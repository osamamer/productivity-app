import { Alert, Box, Button, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import type { StatDefinition } from '../../types/Stats';
import type { CheckpointAggregation, CheckpointDraft } from '../../types/Path';
import { AGGREGATION_OPTIONS, toCheckpointDraft, type CheckpointForm } from './checkpointDraft';
import { valueTypeOf, type StatOption } from './pathDraft';

interface Props {
    initial: CheckpointForm;
    options: StatOption[];
    definitions: StatDefinition[];
    submitLabel: string;
    onSubmit: (draft: CheckpointDraft) => Promise<void>;
    onCancel: () => void;
}

const SOURCE_LABELS: Record<string, string> = { DURATION: 'Duration', NUMBER: 'Number', TIME: 'Time', RANGE: 'Range', BOOLEAN: 'Yes/no' };

/** A checkpoint's name, date and the stat metric that reaches it. */
export function CheckpointEditor({ initial, options, definitions, submitLabel, onSubmit, onCancel }: Props) {
    const [form, setForm] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const definition = definitions.find(item => item.id === form.statDefinitionId);
    const unit = valueTypeOf(definition, form.valueSource) === 'DURATION' ? 'hours' : definition?.unit;
    const update = (change: Partial<CheckpointForm>) => setForm(current => ({ ...current, ...change }));

    const submit = async () => {
        const draft = toCheckpointDraft(form, definitions);
        if (typeof draft === 'string') return setError(draft);
        setSaving(true);
        setError(null);
        try {
            await onSubmit(draft);
        } catch (saveError) {
            console.error('Could not save the checkpoint:', saveError);
            setError(saveError instanceof Error ? saveError.message : 'Could not save the checkpoint.');
            setSaving(false);
        }
    };

    return (
        <Box sx={{ display: 'grid', gap: 1.25, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField size="small" label="Checkpoint" value={form.name} placeholder="Act II done" sx={{ flex: '2 1 200px' }}
                           inputProps={{ maxLength: 120 }} onChange={event => update({ name: event.target.value })} />
                <TextField size="small" type="date" label="Date" value={form.targetDate} sx={{ flex: '1 1 150px' }}
                           InputLabelProps={{ shrink: true }} helperText="Optional" onChange={event => update({ targetDate: event.target.value })} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField select size="small" label="Measured by" value={definition ? form.statDefinitionId : ''} sx={{ flex: '2 1 200px' }}
                           onChange={event => update({ statDefinitionId: event.target.value, valueSource: 'VALUE' })}>
                    {options.map(option => <MenuItem key={option.definition.id} value={option.definition.id}>{option.label}</MenuItem>)}
                </TextField>
                {(definition?.additionalInputTypes?.length ?? 0) > 0 && (
                    <TextField select size="small" label="Measure" value={form.valueSource} sx={{ width: 130 }}
                               onChange={event => update({ valueSource: event.target.value })}>
                        <MenuItem value="VALUE">{SOURCE_LABELS[definition?.type ?? ''] ?? 'Value'}</MenuItem>
                        {definition?.additionalInputTypes?.map(source => <MenuItem key={source} value={source}>{SOURCE_LABELS[source] ?? source}</MenuItem>)}
                    </TextField>
                )}
                <TextField select size="small" label="Count" value={form.aggregation} sx={{ flex: '2 1 200px' }}
                           helperText={AGGREGATION_OPTIONS.find(option => option.value === form.aggregation)?.help}
                           onChange={event => update({ aggregation: event.target.value as CheckpointAggregation })}>
                    {AGGREGATION_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField size="small" label={unit ? `Reached at (${unit})` : 'Reached at'} value={form.target} sx={{ flex: '1 1 140px' }}
                           inputProps={{ inputMode: 'decimal' }} onChange={event => update({ target: event.target.value })} />
                {form.aggregation !== 'LATEST' && (
                    <TextField size="small" label="Already done" value={form.baseline} sx={{ flex: '1 1 140px' }}
                               helperText="Progress from before you logged it" inputProps={{ inputMode: 'decimal' }}
                               onChange={event => update({ baseline: event.target.value })} />
                )}
                <TextField size="small" type="date" label="Counting from" value={form.countFrom} sx={{ flex: '1 1 150px' }}
                           InputLabelProps={{ shrink: true }} onChange={event => update({ countFrom: event.target.value })} />
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={onCancel} sx={{ textTransform: 'none' }}>Cancel</Button>
                <Button size="small" variant="contained" onClick={submit} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    {submitLabel}
                </Button>
            </Box>
        </Box>
    );
}
