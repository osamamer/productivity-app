import React, { useRef, useState, useEffect } from 'react';
import {
    Box, Typography, Stack, ToggleButton, ToggleButtonGroup,
    Slider, Button, Alert, CircularProgress, Divider,
} from '@mui/material';
import { format } from 'date-fns';
import { StatDefinition, StatEntryStatus } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getBooleanChoiceColor, showStatFeedback } from '../../services/statFeedback';
import { minutesToTimeValue, timeValueToMinutes } from '../../services/utils/statValues';
import { DurationInput } from './DurationInput';
import { AppTimeField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';
import { readStatInputPreference, saveStatInputPreference } from '../../services/utils/inputPreferences';

interface Props {
    definitions: StatDefinition[];
    onSaved: () => void;
}

export function TodayCheckIn({ definitions, onSaved }: Props) {
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [statuses, setStatuses] = useState<Record<string, StatEntryStatus>>({});
    // touched tracks which definitions have been explicitly set by the user (or pre-loaded from today's entries)
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const feedbackAnchorRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (definitions.length === 0) {
            setLoading(false);
            return;
        }
        statService.getTodayEntries()
        .then(entries => {
            const initial: Record<string, number | null> = {};
            const initialStatuses: Record<string, StatEntryStatus> = {};
            const preTouched = new Set<string>();
            definitions.forEach(d => {
                initial[d.id] = d.type === 'TIME' || d.type === 'DURATION'
                    ? readStatInputPreference(d.id, d.type)
                    : null;
                initialStatuses[d.id] = 'RECORDED';
            });
            entries.forEach(e => {
                initial[e.statDefinitionId] = e.value;
                initialStatuses[e.statDefinitionId] = e.status ?? 'RECORDED';
                preTouched.add(e.statDefinitionId);
            });
            setValues(initial);
            setStatuses(initialStatuses);
            setTouched(preTouched);
            })
            .catch(e => {
                console.error("Failed to load today's check-in entries:", e);
                setError("Failed to load today's entries.");
            })
            .finally(() => setLoading(false));
    }, [definitions]);

    const setValue = (id: string, v: number | null, status: StatEntryStatus = 'RECORDED') => {
        setValues(prev => ({ ...prev, [id]: v }));
        setStatuses(prev => ({ ...prev, [id]: status }));
        const definition = definitions.find(item => item.id === id);
        if (v !== null && (definition?.type === 'TIME' || definition?.type === 'DURATION')) {
            saveStatInputPreference(id, definition.type, v);
        }
        setTouched(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        const today = format(new Date(), 'yyyy-MM-dd');
        try {
            const toSave = definitions.filter(d => touched.has(d.id));
            await Promise.all(
                toSave.map(d =>
                    statService.recordEntry({
                        statDefinitionId: d.id,
                        date: today,
                        value: values[d.id] ?? null,
                        status: statuses[d.id],
                    })
                )
            );
            toSave.forEach(definition => {
                const value = values[definition.id];
                if (value !== null && value !== undefined && statuses[definition.id] !== 'NOT_PLANNED') {
                    showStatFeedback(definition, value, feedbackAnchorRef.current);
                }
            });
            setSuccess(true);
            onSaved();
        } catch (e) {
            console.error('Failed to save check-in:', e);
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 3 }} />;
    if (definitions.length === 0) return null;

    return (
        <Box sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
                Today's Check-In — {format(new Date(), 'MMMM d, yyyy')}
            </Typography>
            <Stack spacing={3} sx={{ mt: 2 }}>
                {definitions.map((def, i) => (
                    <Box key={def.id}>
                        {i > 0 && <Divider sx={{ mb: 3 }} />}
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{def.name}</Typography>
                        {def.description && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                {def.description}
                            </Typography>
                        )}
                            {def.type === 'BOOLEAN' && (
                                <ToggleButtonGroup
                                    value={statuses[def.id] === 'NOT_PLANNED'
                                        ? 'not-planned'
                                        : values[def.id] === 1 ? 'yes' : values[def.id] === 0 ? 'no' : null}
                                    exclusive
                                    onChange={(_, v) => setValue(
                                        def.id,
                                        v === null ? null : v === 'yes' ? 1 : 0,
                                        v === 'not-planned' ? 'NOT_PLANNED' : 'RECORDED',
                                    )}
                                    size="small"
                                >
                                <ToggleButton
                                    value="yes"
                                    onClick={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                    sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(def, 1)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(def, 1)}.dark` } } }}
                                >
                                    Yes
                                </ToggleButton>
                                <ToggleButton
                                    value="not-planned"
                                    sx={{ '&.Mui-selected': { bgcolor: 'warning.main', color: 'warning.contrastText', '&:hover': { bgcolor: 'warning.dark' } } }}
                                >
                                    Not planned
                                </ToggleButton>
                                <ToggleButton
                                    value="no"
                                    onClick={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                    sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(def, 0)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(def, 0)}.dark` } } }}
                                >
                                    No
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}
                        {def.type === 'NUMBER' && (
                            <AppNumberField
                                autoComplete="off"
                                size="small"
                                value={values[def.id] ?? ''}
                                onChange={e => setValue(def.id, e.target.value === '' ? null : Number(e.target.value))}
                                onStepValueChange={value => setValue(def.id, value)}
                                onFocus={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                sx={{ width: 160 }}
                            />
                        )}
                        {def.type === 'TIME' && (
                            <AppTimeField
                                label={def.name}
                                size="small"
                                value={minutesToTimeValue(values[def.id])}
                                onChange={value => setValue(
                                    def.id,
                                    value ? timeValueToMinutes(value) : null,
                                )}
                                onFocus={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                minutesStep={1}
                                inputProps={{ 'aria-label': `${def.name} time` }}
                                sx={{ width: 160 }}
                            />
                        )}
                        {def.type === 'DURATION' && (
                            <DurationInput
                                value={values[def.id] ?? null}
                                onChange={value => setValue(def.id, value)}
                                onFocus={event => { feedbackAnchorRef.current = event.currentTarget; }}
                            />
                        )}
                        {def.type === 'RANGE' && (
                            <Box sx={{ px: 1, width: 300 }}>
                                <Slider
                                    value={values[def.id] ?? def.minValue ?? 0}
                                    min={def.minValue}
                                    max={def.maxValue}
                                    step={1}
                                    marks
                                    valueLabelDisplay="auto"
                                    onChange={(event, v) => {
                                        feedbackAnchorRef.current = event.currentTarget as HTMLElement;
                                        setValue(def.id, v as number);
                                    }}
                                    color={touched.has(def.id) ? 'primary' : 'secondary'}
                                />
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">{def.minValue}</Typography>
                                    <Typography variant="caption" color="text.secondary">{def.maxValue}</Typography>
                                </Stack>
                                <Button size="small" onClick={() => setValue(def.id, null)}>
                                    Clear
                                </Button>
                                {!touched.has(def.id) && (
                                    <Typography variant="caption" color="text.secondary">
                                        Move the slider to record a value
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                ))}
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mt: 2 }}>Check-in saved!</Alert>}
            <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || touched.size === 0}
                sx={{ mt: 3 }}
            >
                {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Check-In'}
            </Button>
        </Box>
    );
}
