import React, { useRef, useState, useEffect } from 'react';
import {
    alpha, Box, Stack, Tooltip, Typography, CircularProgress, Popover,
    ToggleButton, ToggleButtonGroup, Slider, Button,
    Alert,
} from '@mui/material';
import { useTheme, Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { format, subDays } from 'date-fns';
import { StatDefinition, StatEntry, StatEntryStatus } from '../../types/Stats';
import { getLastMonthWindow, statService } from '../../services/api/statService';
import { KeyboardEvent } from 'react';
import { effectiveStatMorality, getBooleanChoiceColor, getStatFeedback, showStatFeedback } from '../../services/statFeedback';
import {
    formatDurationValue,
    formatTimeValue,
    minutesToTimeValue,
    timeValueToMinutes,
    timeValueToScale,
} from '../../services/utils/statValues';
import { DurationInput } from './DurationInput';
import { readStatInputPreference, saveStatInputPreference } from '../../services/utils/inputPreferences';
import { statValueColor, statValueLabel } from './statVisualization';
import { AppTimeField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';

const CIRCLE_SIZE = 24;
const THRESHOLD_COLOR_TRANSITION = 0.75;
const SLEEP_GREEN_BAND_MINUTES = 60;
const SLEEP_BAD_COLOR_RANGE_MINUTES = 3 * 60;

function isSleepStat(def: StatDefinition): boolean {
    return def.systemKey === 'sleep_hours'
        || def.systemKey === 'sleep_time'
        || def.systemKey === 'wake_up_time';
}

function sleepGoodDirectionImprovement(def: StatDefinition, value: number): number {
    return def.type === 'TIME'
        ? timeValueToScale(def, def.goodThreshold!) - timeValueToScale(def, value)
        : value - def.goodThreshold!;
}

function sleepColorHue(def: StatDefinition, value: number): number {
    const improvement = sleepGoodDirectionImprovement(def, value);
    if (improvement >= -SLEEP_GREEN_BAND_MINUTES) {
        const greenProgress = Math.min(
            1,
            (improvement + SLEEP_GREEN_BAND_MINUTES) / (2 * SLEEP_GREEN_BAND_MINUTES),
        );
        return 90 + greenProgress * 30;
    }

    const redProgress = Math.min(
        1,
        (-improvement - SLEEP_GREEN_BAND_MINUTES) / SLEEP_BAD_COLOR_RANGE_MINUTES,
    );
    return 90 * (1 - redProgress);
}

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

function thresholdGoodnessRatio(def: StatDefinition, value: number): number | null {
    if ((def.type !== 'NUMBER' && def.type !== 'RANGE' && def.type !== 'TIME' && def.type !== 'DURATION')
        || def.goodThreshold == null
        || !Number.isFinite(def.goodThreshold)) {
        return null;
    }

    const morality = effectiveStatMorality(def);
    if (morality !== 'GOOD' && morality !== 'BAD') return null;

    return def.type === 'TIME'
        ? timeValueToScale(def, def.goodThreshold) === 0
            ? timeValueToScale(def, value) === 0 ? 2 : 0
            : timeValueToScale(def, def.goodThreshold) / Math.max(timeValueToScale(def, value), 1)
        : getThresholdGoodnessRatio(value, def.goodThreshold, morality);
}

function thresholdColorProgress(def: StatDefinition, value: number): number | null {
    const goodnessRatio = thresholdGoodnessRatio(def, value);
    return goodnessRatio == null
        ? null
        : Math.min(1, Math.abs(goodnessRatio - 1) / THRESHOLD_COLOR_TRANSITION);
}

function getThresholdCircleBg(def: StatDefinition, value: number, theme: Theme): string | null {
    if (isSleepStat(def)) return `hsl(${Math.round(sleepColorHue(def, value))}, 65%, 42%)`;

    const goodnessRatio = thresholdGoodnessRatio(def, value);
    if (goodnessRatio == null) return null;

    const progressFromThreshold = Math.min(
        1,
        Math.abs(goodnessRatio - 1) / THRESHOLD_COLOR_TRANSITION,
    );
    const directionColor = goodnessRatio >= 1
        ? theme.palette.success.dark
        : theme.palette.error.dark;
    const thresholdColor = `color-mix(in srgb, ${theme.palette.info.medium ?? theme.palette.warning.main} 78%, ${theme.palette.common.black} 22%)`;
    return `color-mix(in srgb, ${directionColor} ${progressFromThreshold * 100}%, ${thresholdColor} ${(1 - progressFromThreshold) * 100}%)`;
}

function getCircleTextColor(def: StatDefinition, value: number, theme: Theme): string {
    if (isSleepStat(def)) {
        return sleepColorHue(def, value) >= 90 ? theme.palette.common.white : '#111827';
    }

    const progress = thresholdColorProgress(def, value);
    if (progress != null && progress < 0.72) return '#111827';
    return def.type === 'TIME' || def.type === 'DURATION'
        ? theme.palette.common.white
        : theme.palette.text.primary;
}

function getCircleBg(
    def: StatDefinition,
    value: number | undefined,
    theme: Theme,
    status: StatEntryStatus = 'RECORDED',
): string {
    if (value === undefined) return theme.palette.action.disabledBackground;
    if (def.type === 'BOOLEAN') {
        return theme.palette[getBooleanChoiceColor(def, value === 1 ? 1 : 0, status)].main;
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
        case 'TIME':
        case 'DURATION':
            return statValueColor(def, value, theme);
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

function formatDurationCircleValue(value: number): string {
    const rounded = Math.max(0, Math.round(value));
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${(rounded / 60).toFixed(1)}h`;
}

function formatSleepDurationCircleValue(value: number): string {
    return `${(Math.max(0, value) / 60).toFixed(1)}h`;
}

interface PopoverState {
    anchorEl: HTMLElement;
    date: string;
}

interface Props {
    definition: StatDefinition;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onError?: (message: string) => void;
}

function recentValueMap(entries: StatEntry[] | undefined, recentStart: string, to: string) {
    return new Map(
        (entries ?? [])
            .filter(entry => entry.date >= recentStart && entry.date <= to)
            .map(entry => [entry.date, entry.value]),
    );
}

function recentStatusMap(entries: StatEntry[] | undefined, recentStart: string, to: string): Map<string, StatEntryStatus> {
    return new Map<string, StatEntryStatus>(
        (entries ?? [])
            .filter(entry => entry.date >= recentStart && entry.date <= to)
            .map(entry => [entry.date, entry.status ?? 'RECORDED'] as [string, StatEntryStatus]),
    );
}

export const StatRecentDots = React.memo(function StatRecentDots({ definition, refreshKey, onEntryChanged, onError }: Props) {
    const theme = useTheme();
    const { from, to } = getLastMonthWindow();
    const recentStart = format(subDays(new Date(), 4), 'yyyy-MM-dd');
    const last5Days = Array.from({ length: 5 }, (_, i) =>
        format(subDays(new Date(), 4 - i), 'yyyy-MM-dd')
    );
    const cachedEntries = statService.getCachedEntries(definition.id, from, to);
    const [valueMap, setValueMap] = useState<Map<string, number>>(() => recentValueMap(cachedEntries, recentStart, to));
    const [statusMap, setStatusMap] = useState<Map<string, StatEntryStatus>>(() => recentStatusMap(cachedEntries, recentStart, to));
    const [loading, setLoading] = useState(() => !cachedEntries);

    // Popover state
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [editValue, setEditValue] = useState<number | null>(null);
    const [editStatus, setEditStatus] = useState<StatEntryStatus>('RECORDED');
    const [saveError, setSaveError] = useState<string | null>(null);
    const popoverContentRef = useRef<HTMLDivElement | null>(null);
    const saveButtonRef = useRef<HTMLButtonElement | null>(null);
    const entryMutationVersionsRef = useRef(new Map<string, number>());

    useEffect(() => {
        let cancelled = false;
        const cached = statService.getCachedEntries(definition.id, from, to);
        if (cached) {
            setValueMap(recentValueMap(cached, recentStart, to));
            setStatusMap(recentStatusMap(cached, recentStart, to));
            setLoading(false);
        }

        statService.getEntries(definition.id, from, to)
            .then(entries => {
                if (!cancelled) {
                    setValueMap(recentValueMap(entries, recentStart, to));
                    setStatusMap(recentStatusMap(entries, recentStart, to));
                }
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
        setEditStatus(statusMap.get(date) ?? 'RECORDED');
        setEditValue(existing ?? (
            definition.type === 'TIME' || definition.type === 'DURATION'
                ? readStatInputPreference(definition.id, definition.type)
                : null
        ));
        setSaveError(null);
        setPopover({ anchorEl: e.currentTarget, date });
    };

    const closePopover = () => {
        setPopover(null);
        setEditValue(null);
        setEditStatus('RECORDED');
        setSaveError(null);
    };

    const handleSave = () => {
        if (!popover) return;
        const activePopover = popover;
        const previousValue = valueMap.get(activePopover.date);
        const previousStatus = statusMap.get(activePopover.date);
        const previousHadEntry = valueMap.has(activePopover.date);
        // The editor unmounts before the request resolves, so preserve the source circle's position.
        const feedbackAnchor = activePopover.anchorEl.getBoundingClientRect();
        const mutationVersion = (entryMutationVersionsRef.current.get(activePopover.date) ?? 0) + 1;
        entryMutationVersionsRef.current.set(activePopover.date, mutationVersion);
        const nextValue = editStatus === 'NOT_PLANNED' ? 0 : editValue;

        // Reflect the edit before the request starts. The service also keeps this
        // value in its optimistic cache so the chart and summary update together.
        setValueMap(previous => {
            const next = new Map(previous);
            if (editValue === null && editStatus !== 'NOT_PLANNED') next.delete(activePopover.date);
            else next.set(activePopover.date, nextValue ?? 0);
            return next;
        });
        setStatusMap(previous => {
            const next = new Map(previous);
            if (editValue === null && editStatus !== 'NOT_PLANNED') next.delete(activePopover.date);
            else next.set(activePopover.date, editStatus);
            return next;
        });
        closePopover();
        setSaveError(null);
        const request = {
                statDefinitionId: definition.id,
                date: activePopover.date,
                value: editStatus === 'NOT_PLANNED' ? null : editValue,
                status: editStatus,
            };
        const savePromise = statService.recordEntry(request);
        onEntryChanged?.(definition.id);
        void savePromise
            .then(() => {
                if (entryMutationVersionsRef.current.get(activePopover.date) !== mutationVersion) return;
                if (editValue !== null && (definition.type === 'TIME' || definition.type === 'DURATION')) {
                    saveStatInputPreference(definition.id, definition.type, editValue);
                }
                if (editValue !== null && editStatus !== 'NOT_PLANNED') {
                    showStatFeedback(definition, editValue, feedbackAnchor, { positiveEffect: 'pulse' });
                }
            })
            .catch(err => {
                console.error('Failed to save entry:', err);
                if (entryMutationVersionsRef.current.get(activePopover.date) === mutationVersion) {
                    setValueMap(previous => {
                        const next = new Map(previous);
                        if (previousHadEntry) next.set(activePopover.date, previousValue!);
                        else next.delete(activePopover.date);
                        return next;
                    });
                    setStatusMap(previous => {
                        const next = new Map(previous);
                        if (previousHadEntry) next.set(activePopover.date, previousStatus ?? 'RECORDED');
                        else next.delete(activePopover.date);
                        return next;
                    });
                    onEntryChanged?.(definition.id);
                    setSaveError('Failed to save. Please try again.');
                }
                onError?.('Failed to save this statistic.');
            });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter') return;

        // Let multiline or composition-heavy inputs keep their default behavior.
        const target = event.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;

        event.preventDefault();
        void handleSave();
    };

    const handleDurationBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && popoverContentRef.current?.contains(nextTarget)) return;
        closePopover();
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
                    const status = statusMap.get(date) ?? 'RECORDED';
                    const bg = getCircleBg(definition, value, theme, status);
                    const hasVisibleValue = definition.type === 'NUMBER'
                        || definition.type === 'TIME'
                        || definition.type === 'DURATION';
                    const label = hasEntry && hasVisibleValue
                            ? definition.type === 'NUMBER'
                            ? formatCircleValue(value!)
                            : definition.type === 'DURATION'
                                ? definition.systemKey === 'sleep_hours'
                                    ? formatSleepDurationCircleValue(value!)
                                    : formatDurationCircleValue(value!)
                                : statValueLabel(definition, value!)
                        : null;
                    const booleanIcon = hasEntry && definition.type === 'BOOLEAN'
                        ? status === 'NOT_PLANNED'
                            ? <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: alpha(theme.palette.common.white, 0.78) }} />
                            : value === 1
                            ? <CheckIcon sx={{ fontSize: 18, color: alpha(theme.palette.common.white, 0.78), fontWeight: 700 }} />
                            : <CloseIcon sx={{ fontSize: 18, color: alpha(theme.palette.common.white, 0.78), fontWeight: 700 }} />
                        : null;
                    const tooltipText = hasEntry
                        ? definition.type === 'BOOLEAN'
                            ? status === 'NOT_PLANNED' ? 'Not planned' : value === 1 ? 'Yes' : 'No'
                            : definition.type === 'TIME'
                                ? formatTimeValue(value)
                                : definition.type === 'DURATION'
                                    ? formatDurationValue(value)
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
                                    border: definition.type === 'NUMBER' && !hasEntry
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
                                            fontSize: definition.type === 'DURATION'
                                                ? label.length > 5 ? 7 : 8
                                                : label.length > 5 ? 6 : label.length > 3 ? 7 : 9,
                                            fontWeight: 700,
                                            color: getCircleTextColor(definition, value!, theme),
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
                    <Box
                        ref={popoverContentRef}
                        onClick={event => {
                            if (!(event.target instanceof Node) || !saveButtonRef.current?.contains(event.target)) {
                                event.stopPropagation();
                            }
                        }}
                        onKeyDown={handleKeyDown}
                    >
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                            {definition.name} — {format(new Date(popover.date + 'T12:00:00'), 'EEEE, MMM d')}
                        </Typography>

                        {definition.type === 'BOOLEAN' && (
                            <ToggleButtonGroup
                                value={editStatus === 'NOT_PLANNED'
                                    ? 'not-planned'
                                    : editValue === 1 ? 'yes' : editValue === 0 ? 'no' : null}
                                exclusive
                                onChange={(_, v) => {
                                    setEditStatus(v === 'not-planned' ? 'NOT_PLANNED' : 'RECORDED');
                                    setEditValue(v === null ? null : v === 'yes' ? 1 : 0);
                                }}
                                size="small"
                            >
                                <ToggleButton
                                    value="yes"
                                    sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.dark` } } }}
                                >
                                    Yes
                                </ToggleButton>
                                <ToggleButton
                                    value="not-planned"
                                    sx={{ '&.Mui-selected': { bgcolor: 'notPlanned.main', color: 'notPlanned.contrastText', '&:hover': { bgcolor: 'notPlanned.dark' } } }}
                                >
                                    Not planned
                                </ToggleButton>
                                <ToggleButton
                                    value="no"
                                    sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.dark` } } }}
                                >
                                    No
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}

                        {definition.type === 'NUMBER' && (
                            <AppNumberField
                                autoComplete="off"
                                size="small"
                                value={editValue ?? ''}
                                onChange={e => setEditValue(e.target.value === '' ? null : Number(e.target.value))}
                                onStepValueChange={value => setEditValue(value)}
                                autoFocus
                                sx={{ width: 160 }}
                            />
                        )}

                        {definition.type === 'TIME' && (
                            <AppTimeField
                                label={definition.name}
                                size="small"
                                value={minutesToTimeValue(editValue)}
                                onChange={value => {
                                    setEditValue(value ? timeValueToMinutes(value) : null);
                                }}
                                autoFocus
                                minutesStep={1}
                                inputProps={{ 'aria-label': `${definition.name} time` }}
                                sx={{ width: '100%' }}
                            />
                        )}

                        {definition.type === 'DURATION' && (
                            <DurationInput
                                value={editValue}
                                onChange={setEditValue}
                                autoFocus
                                onTabFromMinutes={event => {
                                    const saveButton = saveButtonRef.current;
                                    if (!saveButton || saveButton.disabled) return;
                                    event.preventDefault();
                                    saveButton.focus();
                                }}
                                onBlur={handleDurationBlur}
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
                                        setEditValue(v as number);
                                    }}
                                />
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">{definition.minValue}</Typography>
                                    <Typography variant="caption" color="text.secondary">{definition.maxValue}</Typography>
                                </Stack>
                                <Button size="small" onClick={() => setEditValue(null)}>
                                    Clear
                                </Button>
                            </Box>
                        )}

                        {saveError && (
                            <Alert severity="error" sx={{ mt: 1.5, py: 0 }}>{saveError}</Alert>
                        )}

                        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                            <Button
                                size="small"
                                onClick={event => {
                                    event.stopPropagation();
                                    closePopover();
                                }}
                                sx={{ mr: 1 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                ref={saveButtonRef}
                                size="small"
                                variant="contained"
                                onClick={handleSave}
                            >
                                Save
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Popover>
        </>
    );
});
