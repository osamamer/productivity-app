import React, { useRef, useState, useEffect } from 'react';
import {
    alpha, Box, Stack, Tooltip, Typography, CircularProgress, Popover,
    ToggleButton, ToggleButtonGroup, TextField, Slider, Button,
    Alert,
} from '@mui/material';
import { useTheme, Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { format, subDays } from 'date-fns';
import { StatDefinition, StatEntry } from '../../types/Stats';
import { getLastMonthWindow, statService } from '../../services/api/statService';
import { KeyboardEvent } from 'react';
import { effectiveStatMorality, getBooleanChoiceColor, getStatFeedback, showStatFeedback } from '../../services/statFeedback';
import { formatTimeValue, minutesToTimeValue, timeValueToMinutes } from '../../services/utils/statValues';

const CIRCLE_SIZE = 24;

function getThresholdGoodnessRatio(
    value: number,
    threshold: number,
    morality: 'GOOD' | 'BAD',
): number {
    if (threshold > 0) {
        if (morality === 'GOOD') return value / threshold;
        return value <= 0 ? 3 : threshold / value;
    }

    const improvement = morality === 'GOOD'
        ? value - threshold
        : threshold - value;
    return 1 + improvement / Math.max(Math.abs(threshold), 1);
}

function getThresholdCircleBg(def: StatDefinition, value: number, theme: Theme): string | null {
    if ((def.type !== 'NUMBER' && def.type !== 'RANGE')
        || def.goodThreshold == null
        || !Number.isFinite(def.goodThreshold)) {
        return null;
    }

    const morality = effectiveStatMorality(def);
    if (morality !== 'GOOD' && morality !== 'BAD') return null;

    const goodnessRatio = getThresholdGoodnessRatio(value, def.goodThreshold, morality);
    if (goodnessRatio >= 1) {
        const progressToMaximum = Math.min(1, (goodnessRatio - 1) / 2);
        const greenWeight = 0.55 + progressToMaximum * 0.45;
        return `color-mix(in srgb, ${theme.palette.success.main} ${greenWeight * 100}%, ${theme.palette.background.paper} ${(1 - greenWeight) * 100}%)`;
    }

    const redProgress = Math.min(0.45, (1 - goodnessRatio) * 0.6);
    const redWeight = theme.palette.mode === 'dark'
        ? 0.9 - redProgress
        : 0.55 + redProgress;
    return `color-mix(in srgb, ${theme.palette.error.main} ${redWeight * 100}%, ${theme.palette.background.paper} ${(1 - redWeight) * 100}%)`;
}

function getCircleBg(def: StatDefinition, value: number | undefined, theme: Theme): string {
    if (value === undefined) return theme.palette.action.disabledBackground;
    if (def.type === 'BOOLEAN') {
        return theme.palette[getBooleanChoiceColor(def, value === 1 ? 1 : 0)].main;
    }

    const thresholdCircleBg = getThresholdCircleBg(def, value, theme);
    if (thresholdCircleBg) return thresholdCircleBg;

    const feedback = getStatFeedback(def, value);
    if (feedback === 'CELEBRATE') return theme.palette.success.main;
    if (feedback === 'SAD') return theme.palette.error.main;

    if (effectiveStatMorality(def) === 'NEUTRAL') {
        switch (def.type) {
            case 'RANGE': {
                const t = Math.max(0, Math.min(1, (value - def.minValue!) / (def.maxValue! - def.minValue!)));
                return `color-mix(in srgb, ${theme.palette.secondary.main} ${(1 - t) * 100}%, ${theme.palette.primary.main} ${t * 100}%)`;
            }
            default:
                break;
        }
    }

    switch (def.type) {
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
    onEntryChanged?: (definitionId: string) => void;
}

function recentValueMap(entries: StatEntry[] | undefined, recentStart: string, to: string) {
    return new Map(
        (entries ?? [])
            .filter(entry => entry.date >= recentStart && entry.date <= to)
            .map(entry => [entry.date, entry.value]),
    );
}

export const StatRecentDots = React.memo(function StatRecentDots({ definition, refreshKey, onEntryChanged }: Props) {
    const theme = useTheme();
    const { from, to } = getLastMonthWindow();
    const recentStart = format(subDays(new Date(), 4), 'yyyy-MM-dd');
    const last5Days = Array.from({ length: 5 }, (_, i) =>
        format(subDays(new Date(), 4 - i), 'yyyy-MM-dd')
    );
    const cachedEntries = statService.getCachedEntries(definition.id, from, to);
    const [valueMap, setValueMap] = useState<Map<string, number>>(() => recentValueMap(cachedEntries, recentStart, to));
    const [loading, setLoading] = useState(() => !cachedEntries);

    // Popover state
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [editValue, setEditValue] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const feedbackAnchorRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        const cached = statService.getCachedEntries(definition.id, from, to);
        if (cached) {
            setValueMap(recentValueMap(cached, recentStart, to));
            setLoading(false);
        }

        statService.getEntries(definition.id, from, to)
            .then(entries => {
                if (!cancelled) setValueMap(recentValueMap(entries, recentStart, to));
            })
            .catch(e => console.error('Failed to load recent dots:', e))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [definition.id, from, recentStart, refreshKey, to]);

    const openPopover = (e: React.MouseEvent<HTMLElement>, date: string) => {
        e.stopPropagation(); // don't select the stat in the left panel
        const existing = valueMap.get(date);
        setEditValue(existing ?? null);
        setSaveError(null);
        feedbackAnchorRef.current = null;
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
            showStatFeedback(definition, editValue, feedbackAnchorRef.current);
            setValueMap(prev => new Map(prev).set(popover.date, editValue));
            onEntryChanged?.(definition.id);
            closePopover();
        } catch (err) {
            console.error('Failed to save entry:', err);
            setSaveError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' || saving || editValue === null) return;

        // Let multiline or composition-heavy inputs keep their default behavior.
        const target = event.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;

        event.preventDefault();
        void handleSave();
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
                    const booleanIcon = hasEntry && definition.type === 'BOOLEAN'
                        ? value === 1
                            ? <CheckIcon sx={{ fontSize: 18, color: alpha(theme.palette.common.white, 0.78), fontWeight: 700 }} />
                            : <CloseIcon sx={{ fontSize: 18, color: alpha(theme.palette.common.white, 0.78), fontWeight: 700 }} />
                        : null;
                    const tooltipText = hasEntry
                        ? definition.type === 'BOOLEAN'
                            ? value === 1 ? 'Yes' : 'No'
                            : definition.type === 'TIME'
                                ? formatTimeValue(value)
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
                                {booleanIcon}
                                {label && !booleanIcon && (
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
                transitionDuration={0}
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
                    <Box onKeyDown={handleKeyDown}>
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
                                    onClick={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                    sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.dark` } } }}
                                >
                                    Yes
                                </ToggleButton>
                                <ToggleButton
                                    value="no"
                                    onClick={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                    sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.dark` } } }}
                                >
                                    No
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}

                        {definition.type === 'NUMBER' && (
                            <TextField
                                type="number"
                                autoComplete="off"
                                size="small"
                                value={editValue ?? ''}
                                onChange={e => setEditValue(e.target.value === '' ? null : Number(e.target.value))}
                                onFocus={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                autoFocus
                                sx={{ width: 160 }}
                            />
                        )}

                        {definition.type === 'TIME' && (
                            <TextField
                                type="time"
                                autoComplete="off"
                                size="small"
                                value={minutesToTimeValue(editValue)}
                                onChange={event => {
                                    const value = event.target.value;
                                    setEditValue(value ? timeValueToMinutes(value) : null);
                                }}
                                onFocus={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                autoFocus
                                inputProps={{ step: 60, 'aria-label': `${definition.name} time` }}
                                sx={{ width: 140 }}
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
                                    onChange={(event, v) => {
                                        feedbackAnchorRef.current = event.currentTarget as HTMLElement;
                                        setEditValue(v as number);
                                    }}
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
});
