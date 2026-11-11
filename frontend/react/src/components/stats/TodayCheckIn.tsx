import React, { useRef, useState, useEffect } from 'react';
import {
    Box, Typography, Stack, Button, Alert, CircularProgress, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { StatDefinition, StatEntryStatus, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getStatFeedbackColor, showStatFeedback } from '../../services/statFeedback';
import { readStatInputPreference, saveStatInputPreference } from '../../services/utils/inputPreferences';
import { StatInputField } from './StatInputField';
import { statInputLabel } from './statInputLabels';
import { groupStatDefinitions } from '../../services/utils/statDefinitionHierarchy';

interface Props {
    definitions: StatDefinition[];
    onSaved: () => void;
}

export function TodayCheckIn({ definitions, onSaved }: Props) {
    const theme = useTheme();
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [additionalValues, setAdditionalValues] = useState<Record<string, Partial<Record<StatType, number>>>>({});
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
            const initialAdditional: Record<string, Partial<Record<StatType, number>>> = {};
            const initialStatuses: Record<string, StatEntryStatus> = {};
            const preTouched = new Set<string>();
            definitions.forEach(d => {
                initial[d.id] = d.type === 'TIME' || d.type === 'DURATION'
                    ? readStatInputPreference(d.id, d.type)
                    : null;
                initialAdditional[d.id] = Object.fromEntries(
                    (d.additionalInputTypes ?? [])
                        .filter(type => type === 'TIME' || type === 'DURATION')
                        .map(type => [type, readStatInputPreference(d.id, type)]),
                );
                initialStatuses[d.id] = 'RECORDED';
            });
            entries.forEach(e => {
                initial[e.statDefinitionId] = e.value;
                initialAdditional[e.statDefinitionId] = e.additionalValues ?? {};
                initialStatuses[e.statDefinitionId] = e.status ?? 'RECORDED';
                preTouched.add(e.statDefinitionId);
            });
            setValues(initial);
            setAdditionalValues(initialAdditional);
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

    const setAdditionalValue = (id: string, type: StatType, value: number | null) => {
        setAdditionalValues(previous => {
            const nextForDefinition = { ...previous[id] };
            if (value == null) delete nextForDefinition[type];
            else nextForDefinition[type] = value;
            return { ...previous, [id]: nextForDefinition };
        });
        if (value != null && (type === 'TIME' || type === 'DURATION')) {
            saveStatInputPreference(id, type, value);
        }
        setTouched(previous => new Set(previous).add(id));
        setSuccess(false);
    };

    const handleSave = async () => {
        const toSave = definitions.filter(definition => touched.has(definition.id));
        const missingPrimary = toSave.find(definition =>
            values[definition.id] == null && statuses[definition.id] !== 'NOT_PLANNED');
        if (missingPrimary) {
            setError(`Choose a value for ${missingPrimary.name} before saving its additional inputs.`);
            return;
        }
        setSaving(true);
        setError(null);
        setSuccess(false);
        const today = format(new Date(), 'yyyy-MM-dd');
        try {
            toSave.forEach(definition => {
                const value = values[definition.id];
                if (value !== null && value !== undefined && statuses[definition.id] !== 'NOT_PLANNED') {
                    showStatFeedback(definition, value, feedbackAnchorRef.current, {
                        color: getStatFeedbackColor(definition, value, theme),
                    });
                }
            });
            await Promise.all(
                toSave.map(d =>
                    statService.recordEntry({
                        statDefinitionId: d.id,
                        date: today,
                        value: values[d.id] ?? null,
                        status: statuses[d.id],
                        additionalValues: statuses[d.id] === 'NOT_PLANNED'
                            ? {}
                            : Object.fromEntries(
                                (d.additionalInputTypes ?? [])
                                    .filter(type => additionalValues[d.id]?.[type] != null)
                                    .map(type => [type, additionalValues[d.id]?.[type]]),
                            ),
                    })
                )
            );
            setSuccess(true);
            onSaved();
        } catch (e) {
            console.error('Failed to save check-in:', e);
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const definitionGroups = groupStatDefinitions(definitions);

    if (loading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 3 }} />;
    if (definitions.length === 0) return null;

    return (
        <Box sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
                Today's Check-In — {format(new Date(), 'MMMM d, yyyy')}
            </Typography>
            <Stack spacing={3} sx={{ mt: 2 }}>
                {definitionGroups.map(({ definition: def, subDefinitions }, i) => (
                    <Box key={def.id}>
                        {i > 0 && <Divider sx={{ mb: 3 }} />}
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{def.name}</Typography>
                        <Stack spacing={1.5}>
                            <StatInputField
                                definition={def}
                                type={def.type}
                                value={values[def.id] ?? null}
                                status={statuses[def.id]}
                                primary
                                onChange={(value, status) => setValue(def.id, value, status)}
                                onFocus={element => { feedbackAnchorRef.current = element; }}
                            />
                            {(def.additionalInputTypes ?? []).map(type => (
                                <Box key={type}>
                                    <Typography variant="caption" color="text.secondary">
                                        {statInputLabel(type)}
                                    </Typography>
                                    <StatInputField
                                        definition={def}
                                        type={type}
                                        value={additionalValues[def.id]?.[type] ?? null}
                                        onChange={value => setAdditionalValue(def.id, type, value)}
                                        onFocus={element => { feedbackAnchorRef.current = element; }}
                                    />
                                </Box>
                            ))}
                            {subDefinitions.map(subDefinition => (
                                <Box key={subDefinition.id} sx={{ mt: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                        {subDefinition.name}
                                    </Typography>
                                    <StatInputField
                                        definition={subDefinition}
                                        type={subDefinition.type}
                                        value={values[subDefinition.id] ?? null}
                                        status={statuses[subDefinition.id]}
                                        primary
                                        onChange={(value, status) => setValue(subDefinition.id, value, status)}
                                        onFocus={element => { feedbackAnchorRef.current = element; }}
                                    />
                                    {(subDefinition.additionalInputTypes ?? []).map(type => (
                                        <Box key={type} sx={{ mt: 1 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {statInputLabel(type)}
                                            </Typography>
                                            <StatInputField
                                                definition={subDefinition}
                                                type={type}
                                                value={additionalValues[subDefinition.id]?.[type] ?? null}
                                                onChange={value => setAdditionalValue(subDefinition.id, type, value)}
                                                onFocus={element => { feedbackAnchorRef.current = element; }}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            ))}
                        </Stack>
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
