import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Stack } from '@mui/material';
import { StatDefinition, StatEntryStatus } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { StatInputField } from './StatInputField';
import { StatInputSection } from './StatEntryInputLayout';

export interface SubStatInputFieldsHandle {
    save: () => Promise<boolean>;
}

interface Props {
    definitions: StatDefinition[];
    date: string;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onError?: (message: string) => void;
    onReadyChange?: (ready: boolean) => void;
    onEnter?: () => void;
    autoSaveOnChange?: boolean;
}

export const SubStatInputFields = forwardRef<SubStatInputFieldsHandle, Props>(function SubStatInputFields({
    definitions,
    date,
    refreshKey,
    onEntryChanged,
    onError,
    onReadyChange,
    onEnter,
    autoSaveOnChange = false,
}, ref) {
    const definitionKey = useMemo(() => definitions.map(definition => definition.id).join(':'), [definitions]);
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [statuses, setStatuses] = useState<Record<string, StatEntryStatus>>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastAutoSaveKeyRef = useRef('');

    useEffect(() => {
        let cancelled = false;
        onReadyChange?.(false);
        if (definitions.length === 0) {
            setLoading(false);
            setValues({});
            setStatuses({});
            setTouched(new Set());
            onReadyChange?.(true);
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
                if (!cancelled) {
                    setLoading(false);
                    onReadyChange?.(true);
                }
            });

        return () => { cancelled = true; };
    }, [date, definitionKey, definitions, onReadyChange, refreshKey]);

    const handleChange = (id: string, value: number | null, status: StatEntryStatus = 'RECORDED') => {
        setValues(previous => ({ ...previous, [id]: value }));
        setStatuses(previous => ({ ...previous, [id]: status }));
        setTouched(previous => new Set(previous).add(id));
        setError(null);
    };

    const autoSaveKey = autoSaveOnChange
        ? `${date}:${definitions
            .filter(definition => touched.has(definition.id))
            .map(definition => `${definition.id}:${values[definition.id]}:${statuses[definition.id]}`)
            .join('|')}`
        : '';

    const handleSave = useCallback(async () => {
        if (loading || saving) return false;
        const definitionsToSave = definitions.filter(definition => touched.has(definition.id));
        if (definitionsToSave.length === 0) return true;
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
            if (autoSaveOnChange) lastAutoSaveKeyRef.current = '';
            setTouched(previous => {
                const next = new Set(previous);
                definitionsToSave.forEach(definition => next.delete(definition.id));
                return next;
            });
            return true;
        } catch (exception) {
            console.error('Failed to save sub-stat inputs:', exception);
            setError('Could not save these values. Please try again.');
            onError?.('Could not save the related stat values.');
            return false;
        } finally {
            setSaving(false);
        }
    }, [autoSaveOnChange, date, definitions, loading, onEntryChanged, onError, saving, statuses, touched, values]);

    useEffect(() => {
        if (!autoSaveOnChange || loading || touched.size === 0 || !autoSaveKey
            || autoSaveKey === lastAutoSaveKeyRef.current) return undefined;
        const timeout = setTimeout(() => {
            lastAutoSaveKeyRef.current = autoSaveKey;
            void handleSave();
        }, 300);
        return () => clearTimeout(timeout);
    }, [autoSaveKey, autoSaveOnChange, handleSave, loading, touched.size]);

    useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        if ((event.target as HTMLElement).tagName === 'TEXTAREA') return;
        event.preventDefault();
        event.stopPropagation();
        if (onEnter) onEnter();
        else void handleSave();
    };

    if (definitions.length === 0) return null;

    return (
        <Box onKeyDown={handleKeyDown} sx={{ width: '100%' }}>
            {loading ? <CircularProgress size={16} sx={{ display: 'block', my: 1 }} /> : (
                <Stack spacing={1.5} sx={{ width: '100%' }}>
                    {definitions.map(definition => (
                        <StatInputSection key={definition.id} title={definition.name}>
                            <StatInputField
                                definition={definition}
                                type={definition.type}
                                value={values[definition.id] ?? null}
                                status={statuses[definition.id]}
                                primary
                                hideInputLabel
                                onChange={(value, status) => handleChange(definition.id, value, status)}
                                onFocus={() => undefined}
                            />
                        </StatInputSection>
                    ))}
                    {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
                </Stack>
            )}
        </Box>
    );
});
