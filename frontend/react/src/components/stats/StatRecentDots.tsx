import React, { useState, useEffect } from 'react';
import {
    Box, Stack, Tooltip, Typography, CircularProgress, Popover,
    ToggleButton, ToggleButtonGroup, TextField, Slider, Button,
    Alert,
} from '@mui/material';
import { useTheme, Theme } from '@mui/material/styles';
import { format, subDays } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { statService } from '../../services/api/statService';

const CIRCLE_SIZE = 28;

function getCircleBg(def: StatDefinition, value: number | undefined, theme: Theme): string {
    if (value === undefined) return theme.palette.action.disabledBackground;
    switch (def.type) {
        case 'BOOLEAN':
            return value === 1 ? theme.palette.success.main : theme.palette.error.main;
        case 'RANGE': {
            const t = Math.max(0, Math.min(1, (value - def.minValue!) / (def.maxValue! - def.minValue!)));
            return `hsl(${Math.round(t * 120)}, 65%, 42%)`;
        }
        case 'NUMBER':
        default:
            return theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.07)';
    }
}

function formatCircleValue(value: number): string {
    if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1);
}

interface PopoverState {
    anchorEl: HTMLElement;
    date: string;
}

interface Props {
    definition: StatDefinition;
    refreshKey: number;
    onEntryChanged?: () => void;
}

export function StatRecentDots({ definition, refreshKey, onEntryChanged }: Props) {
    const theme = useTheme();
    const [valueMap, setValueMap] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);

    // Popover state
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [editValue, setEditValue] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const fetchDots = () => {
        const today = new Date();
        const from = subDays(today, 4);
        setLoading(true);
        statService
            .getEntries(definition.id, format(from, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd'))
            .then(entries => setValueMap(new Map(entries.map(e => [e.date, e.value]))))
            .catch(e => console.error('Failed to load recent dots:', e))
            .finally(() => setLoading(false));
    };

    useEffect(fetchDots, [definition.id, refreshKey]);

    const last5Days = Array.from({ length: 5 }, (_, i) =>
        format(subDays(new Date(), 4 - i), 'yyyy-MM-dd')
    );

    const openPopover = (e: React.MouseEvent<HTMLElement>, date: string) => {
        e.stopPropagation(); // don't select the stat in the left panel
        const existing = valueMap.get(date);
        setEditValue(existing ?? null);
        setSaveError(null);
        setPopover({ anchorEl: e.currentTarget, date });
    };

    const closePopover = () => {
        setPopover(null);
        setEditValue(null);
        setSaveError(null);
    };

    const handleSave = async () => {
        if (!popover || editValue === null) return;
        setSaving(true);
        setSaveError(null);
        try {
            await statService.recordEntry({
                statDefinitionId: definition.id,
                date: popover.date,
                value: editValue,
            });
            setValueMap(prev => new Map(prev).set(popover.date, editValue));
            onEntryChanged?.();
            closePopover();
        } catch (err) {
            console.error('Failed to save entry:', err);
            setSaveError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <CircularProgress size={14} sx={{ mx: 1 }} />;
    }

    return (
        <>
            <Stack direction="row" spacing={0.75} alignItems="center">
                {last5Days.map(date => {
                    const value = valueMap.get(date);
                    const hasEntry = value !== undefined;
                    const bg = getCircleBg(definition, value, theme);
                    const isUnboundedNumber = definition.type === 'NUMBER';
                    const label = hasEntry && isUnboundedNumber ? formatCircleValue(value!) : null;
                    const tooltipText = hasEntry
                        ? definition.type === 'BOOLEAN'
                            ? value === 1 ? 'Yes' : 'No'
                            : String(value)
                        : 'No entry';

                    return (
                        <Tooltip
                            key={date}
                            title={`${format(new Date(date + 'T12:00:00'), 'MMM d')}: ${tooltipText} — click to edit`}
                            placement="top"
                        >
                            <Box
                                onClick={e => openPopover(e, date)}
                                sx={{
                                    width: CIRCLE_SIZE,
                                    height: CIRCLE_SIZE,
                                    borderRadius: '50%',
                                    bgcolor: bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                    border: isUnboundedNumber && !hasEntry
                                        ? `1px dashed ${theme.palette.divider}`
                                        : 'none',
                                    transition: 'filter 0.15s, transform 0.15s',
                                    '&:hover': {
                                        filter: 'brightness(1.2)',
                                        transform: 'scale(1.15)',
                                    },
                                }}
                            >
                                {label && (
                                    <Typography
                                        sx={{
                                            fontSize: label.length > 3 ? 7 : 9,
                                            fontWeight: 700,
                                            color: theme.palette.text.primary,
                                            lineHeight: 1,
                                            userSelect: 'none',
                                        }}
                                    >
                                        {label}
                                    </Typography>
                                )}
                            </Box>
                        </Tooltip>
                    );
                })}
            </Stack>

            <Popover
                open={Boolean(popover)}
                anchorEl={popover?.anchorEl}
                onClose={closePopover}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 2,
                            minWidth: 220,
                            boxShadow: theme.shadows[6],
                        },
                    },
                }}
            >
                {popover && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                            {definition.name} — {format(new Date(popover.date + 'T12:00:00'), 'EEEE, MMM d')}
                        </Typography>

                        {definition.type === 'BOOLEAN' && (
                            <ToggleButtonGroup
                                value={editValue === 1 ? 'yes' : editValue === 0 ? 'no' : null}
                                exclusive
                                onChange={(_, v) => setEditValue(v === 'yes' ? 1 : v === 'no' ? 0 : null)}
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

                        {definition.type === 'NUMBER' && (
                            <TextField
                                type="number"
                                size="small"
                                value={editValue ?? ''}
                                onChange={e => setEditValue(e.target.value === '' ? null : Number(e.target.value))}
                                autoFocus
                                sx={{ width: 160 }}
                            />
                        )}

                        {definition.type === 'RANGE' && (
                            <Box sx={{ px: 1, width: 200 }}>
                                <Slider
                                    value={editValue ?? definition.minValue ?? 0}
                                    min={definition.minValue}
                                    max={definition.maxValue}
                                    step={1}
                                    marks
                                    valueLabelDisplay="auto"
                                    onChange={(_, v) => setEditValue(v as number)}
                                />
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">{definition.minValue}</Typography>
                                    <Typography variant="caption" color="text.secondary">{definition.maxValue}</Typography>
                                </Stack>
                            </Box>
                        )}

                        {saveError && (
                            <Alert severity="error" sx={{ mt: 1.5, py: 0 }}>{saveError}</Alert>
                        )}

                        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                            <Button size="small" onClick={closePopover} sx={{ mr: 1 }}>Cancel</Button>
                            <Button
                                size="small"
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving || editValue === null}
                            >
                                {saving ? <CircularProgress size={14} color="inherit" /> : 'Save'}
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Popover>
        </>
    );
}
