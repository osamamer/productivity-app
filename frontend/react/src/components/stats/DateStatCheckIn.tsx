import React, { useRef, useState, useEffect } from 'react';
import {
    Alert, Box, Button, CircularProgress, Divider, Stack, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { StatDefinition, StatEntryStatus, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getStatFeedbackColor, showStatFeedback } from '../../services/statFeedback';
import { readStatInputPreference, saveStatInputPreference } from '../../services/utils/inputPreferences';
import { StatInputField } from './StatInputField';
import { statInputLabel } from './statInputLabels';
import { groupStatDefinitions } from '../../services/utils/statDefinitionHierarchy';

interface Props {
    date: string;
    definitions: StatDefinition[];
    onSaved: () => void;
}

export function DateStatCheckIn({ date, definitions, onSaved }: Props) {
    const theme = useTheme();
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [additionalValues, setAdditionalValues] = useState<Record<string, Partial<Record<StatType, number>>>>({});
    const [statuses, setStatuses] = useState<Record<string, StatEntryStatus>>({});
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
        setLoading(true);
        setSuccess(false);
        setError(null);
        statService.getEntriesByDate(date)
            .then(entries => {
                const initial: Record<string, number | null> = {};
                const initialAdditional: Record<string, Partial<Record<StatType, number>>> = {};
                const initialStatuses: Record<string, StatEntryStatus> = {};
                const preTouched = new Set<string>();
                definitions.forEach(definition => {
                    initial[definition.id] = definition.type === 'TIME' || definition.type === 'DURATION'
                        ? readStatInputPreference(definition.id, definition.type)
                        : null;
                    initialAdditional[definition.id] = Object.fromEntries(
                        (definition.additionalInputTypes ?? [])
                            .filter(type => type === 'TIME' || type === 'DURATION')
                            .map(type => [type, readStatInputPreference(definition.id, type)]),
                    );
                    initialStatuses[definition.id] = 'RECORDED';
                });
                entries.forEach(entry => {
                    initial[entry.statDefinitionId] = entry.value;
                    initialAdditional[entry.statDefinitionId] = entry.additionalValues ?? {};
                    initialStatuses[entry.statDefinitionId] = entry.status ?? 'RECORDED';
                    preTouched.add(entry.statDefinitionId);
                });
                setValues(initial);
                setAdditionalValues(initialAdditional);
                setStatuses(initialStatuses);
                setTouched(preTouched);
            })
            .catch(exception => {
                console.error('Failed to load stat entries for date:', exception);
                setError('Failed to load existing entries.');
            })
            .finally(() => setLoading(false));
    }, [date, definitions]);

    const setValue = (id: string, value: number | null, status: StatEntryStatus = 'RECORDED') => {
        setValues(previous => ({ ...previous, [id]: value }));
        setStatuses(previous => ({ ...previous, [id]: status }));
        const definition = definitions.find(item => item.id === id);
        if (value !== null && (definition?.type === 'TIME' || definition?.type === 'DURATION')) {
            saveStatInputPreference(id, definition.type, value);
        }
        setTouched(previous => new Set(previous).add(id));
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
        try {
            toSave.forEach(definition => {
                const value = values[definition.id];
                if (value !== null && value !== undefined && statuses[definition.id] !== 'NOT_PLANNED') {
                    showStatFeedback(definition, value, feedbackAnchorRef.current, {
                        color: getStatFeedbackColor(definition, value, theme),
                    });
                }
            });
            await Promise.all(toSave.map(definition => statService.recordEntry({
                statDefinitionId: definition.id,
                date,
                value: values[definition.id] ?? null,
                status: statuses[definition.id],
                additionalValues: Object.fromEntries(
                    (definition.additionalInputTypes ?? [])
                        .filter(type => additionalValues[definition.id]?.[type] != null)
                        .map(type => [type, additionalValues[definition.id]?.[type]]),
                ),
            })));
            setSuccess(true);
            onSaved();
        } catch (exception) {
            console.error('Failed to save stat entries:', exception);
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const definitionGroups = groupStatDefinitions(definitions);

    if (loading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 3 }} />;
    if (definitions.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No stat definitions yet. Create some on the Stats page.
            </Typography>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{
                '&::-webkit-scrollbar': { width: '0.4em' },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'action.disabled',
                    borderRadius: '999px',
                    border: '2px solid transparent',
                    backgroundClip: 'content-box',
                },
                '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'action.active' },
            }}>
                <Stack spacing={3}>
                    {definitionGroups.map(({ definition, subDefinitions }, index) => {
                        return (
                            <Box key={definition.id}>
                                {index > 0 && <Divider sx={{ mb: 3 }} />}
                                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                    {definition.name}
                                </Typography>
                                <Stack spacing={1.5}>
                                    <StatInputField
                                        definition={definition}
                                        type={definition.type}
                                        value={values[definition.id] ?? null}
                                        status={statuses[definition.id]}
                                        primary
                                        onChange={(value, status) => setValue(definition.id, value, status)}
                                        onFocus={element => { feedbackAnchorRef.current = element; }}
                                    />
                                    {(definition.additionalInputTypes ?? []).map(type => (
                                        <Box key={type}>
                                            <Typography variant="caption" color="text.secondary">
                                                {statInputLabel(type)}
                                            </Typography>
                                            <StatInputField
                                                definition={definition}
                                                type={type}
                                                value={additionalValues[definition.id]?.[type] ?? null}
                                                onChange={value => setAdditionalValue(definition.id, type, value)}
                                                onFocus={element => { feedbackAnchorRef.current = element; }}
                                            />
                                        </Box>
                                    ))}
                                    {subDefinitions.length > 0 && (
                                        <Box sx={{ mt: 0.5, pl: 1.5, borderLeft: 1, borderColor: 'divider' }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                Additional inputs
                                            </Typography>
                                            <Stack spacing={1.5} sx={{ mt: 1 }}>
                                                {subDefinitions.map(subDefinition => (
                                                    <Box key={subDefinition.id}>
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
                                    )}
                                </Stack>
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
            <Box sx={{ pt: 2, mt: 2, borderTop: 1, borderColor: 'divider' }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>Saved!</Alert>}
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || touched.size === 0}
                    fullWidth
                    size="small"
                >
                    {saving ? <CircularProgress size={18} color="inherit" /> : 'Save'}
                </Button>
            </Box>
        </Box>
    );
}
