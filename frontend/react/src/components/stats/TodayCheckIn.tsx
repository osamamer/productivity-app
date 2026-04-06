import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Stack, TextField, ToggleButton, ToggleButtonGroup,
    Slider, Button, Alert, CircularProgress, Divider,
} from '@mui/material';
import { format } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { statService } from '../../services/api/statService';

interface Props {
    definitions: StatDefinition[];
    onSaved: () => void;
}

export function TodayCheckIn({ definitions, onSaved }: Props) {
    const [values, setValues] = useState<Record<string, number | null>>({});
    // touched tracks which definitions have been explicitly set by the user (or pre-loaded from today's entries)
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (definitions.length === 0) {
            setLoading(false);
            return;
        }
        statService.getTodayEntries()
            .then(entries => {
                const initial: Record<string, number | null> = {};
                const preTouched = new Set<string>();
                definitions.forEach(d => { initial[d.id] = null; });
                entries.forEach(e => {
                    initial[e.statDefinitionId] = e.value;
                    preTouched.add(e.statDefinitionId);
                });
                setValues(initial);
                setTouched(preTouched);
            })
            .catch(e => {
                console.error("Failed to load today's check-in entries:", e);
                setError("Failed to load today's entries.");
            })
            .finally(() => setLoading(false));
    }, [definitions]);

    const setValue = (id: string, v: number | null) => {
        setValues(prev => ({ ...prev, [id]: v }));
        setTouched(prev => {
            const next = new Set(prev);
            if (v !== null) next.add(id); else next.delete(id);
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
            const toSave = definitions.filter(d => touched.has(d.id) && values[d.id] !== null);
            await Promise.all(
                toSave.map(d =>
                    statService.recordEntry({ statDefinitionId: d.id, date: today, value: values[d.id]! })
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
                                value={values[def.id] === 1 ? 'yes' : values[def.id] === 0 ? 'no' : null}
                                exclusive
                                onChange={(_, v) => setValue(def.id, v === 'yes' ? 1 : v === 'no' ? 0 : null)}
                                size="small"
                            >
                                <ToggleButton
                                    value="yes"
                                    sx={{ '&.Mui-selected': { bgcolor: 'success.main', color: 'white', '&:hover': { bgcolor: 'success.dark' } } }}
                                >
                                    Yes
                                </ToggleButton>
                                <ToggleButton
                                    value="no"
                                    sx={{ '&.Mui-selected': { bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } } }}
                                >
                                    No
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}
                        {def.type === 'NUMBER' && (
                            <TextField
                                type="number"
                                size="small"
                                value={values[def.id] ?? ''}
                                onChange={e => setValue(def.id, e.target.value === '' ? null : Number(e.target.value))}
                                sx={{ width: 160 }}
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
                                    onChange={(_, v) => setValue(def.id, v as number)}
                                    color={touched.has(def.id) ? 'primary' : 'secondary'}
                                />
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">{def.minValue}</Typography>
                                    <Typography variant="caption" color="text.secondary">{def.maxValue}</Typography>
                                </Stack>
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
