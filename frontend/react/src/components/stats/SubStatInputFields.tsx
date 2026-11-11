import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { StatDefinition, StatEntryStatus } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { StatInputField } from './StatInputField';

interface Props {
    definitions: StatDefinition[];
    date: string;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onError?: (message: string) => void;
}

export function SubStatInputFields({ definitions, date, refreshKey, onEntryChanged, onError }: Props) {
    const definitionKey = useMemo(() => definitions.map(definition => definition.id).join(':'), [definitions]);
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [statuses, setStatuses] = useState<Record<string, StatEntryStatus>>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (definitions.length === 0) {
            setLoading(false);
            setValues({});
            setStatuses({});
            setTouched(new Set());
            return undefined;
        }

        setLoading(true);
        setError(null);
        Promise.all(definitions.map(async definition => {
            const entries = await statService.getEntries(definition.id, date, date);
            return [definition.id, entries[0]] as const;
        }))
            .then(entries => {
                if (cancelled) return;
                const nextValues: Record<string, number | null> = {};
                const nextStatuses: Record<string, StatEntryStatus> = {};
                entries.forEach(([id, entry]) => {
                    nextValues[id] = entry?.value ?? null;
                    nextStatuses[id] = entry?.status ?? 'RECORDED';
                });
                setValues(nextValues);
                setStatuses(nextStatuses);
                setTouched(new Set());
            })
            .catch(exception => {
                console.error('Failed to load sub-stat inputs:', exception);
                if (!cancelled) setError('Could not load these values.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [date, definitionKey, definitions, refreshKey]);

    const handleChange = (id: string, value: number | null, status: StatEntryStatus = 'RECORDED') => {
        setValues(previous => ({ ...previous, [id]: value }));
        setStatuses(previous => ({ ...previous, [id]: status }));
        setTouched(previous => new Set(previous).add(id));
        setError(null);
    };

    const handleSave = async () => {
        const definitionsToSave = definitions.filter(definition => touched.has(definition.id));
        if (definitionsToSave.length === 0) return;
        setSaving(true);
        setError(null);
        try {
            await Promise.all(definitionsToSave.map(definition => statService.recordEntry({
                statDefinitionId: definition.id,
                date,
                value: statuses[definition.id] === 'NOT_PLANNED' ? null : values[definition.id],
                status: statuses[definition.id],
            })));
            definitionsToSave.forEach(definition => onEntryChanged?.(definition.id));
            setTouched(new Set());
        } catch (exception) {
            console.error('Failed to save sub-stat inputs:', exception);
            setError('Could not save these values. Please try again.');
            onError?.('Could not save the related stat values.');
        } finally {
            setSaving(false);
        }
    };

    if (definitions.length === 0) return null;

    return (
        <Box sx={{ mt: 1.5 }}>
            {loading ? <CircularProgress size={16} sx={{ display: 'block', my: 1 }} /> : (
                <Stack spacing={1.25} sx={{ mt: 1 }}>
                    {definitions.map(definition => (
                        <Stack key={definition.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, flex: 1 }} noWrap>
                                {definition.name}
                            </Typography>
                            <StatInputField
                                definition={definition}
                                type={definition.type}
                                value={values[definition.id] ?? null}
                                status={statuses[definition.id]}
                                primary
                                onChange={(value, status) => handleChange(definition.id, value, status)}
                                onFocus={() => undefined}
                            />
                        </Stack>
                    ))}
                    {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
                    {touched.size > 0 && (
                        <Button size="small" onClick={() => void handleSave()} disabled={saving} sx={{ alignSelf: 'flex-end' }}>
                            {saving ? <CircularProgress size={16} /> : 'Save'}
                        </Button>
                    )}
                </Stack>
            )}
        </Box>
    );
}
