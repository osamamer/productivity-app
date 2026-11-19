import React, { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Checkbox, FormControlLabel, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { StatDefinition, StatEntry, StatSummary, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';
import { statNumericValueLabel } from './statVisualization';
import {
    formatDurationValue,
    formatTimeValue,
    timeValueFromScale,
    timeValueToScale,
} from '../../services/utils/statValues';
import { useUser } from '../../hooks/useUser';
import {
    readStatViewPreferences,
    statViewPreferencesStorageKey,
    StatViewPreferences,
    writeStatViewPreferences,
} from '../../services/utils/statViewPreferences';
import { statPeriodAverage, statPeriodBest, supportsUnloggedDaysAsZero, unloggedDayCount } from './statSummaryValues';

interface TileProps {
    label: string;
    value: string;
    onClick?: () => void;
    hint?: string;
}

function SummaryTile({ label, value, onClick, hint }: TileProps) {
    const theme = useTheme();
    return (
        <Box
            component={onClick ? ButtonBase : 'div'}
            onClick={onClick}
            title={hint}
            sx={{
            display: 'block',
            font: 'inherit',
            color: 'inherit',
            flex: 1,
            textAlign: 'center',
            py: 1.25,
            px: 1,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
            ...(onClick && { '&:hover': { bgcolor: 'action.hover' } }),
        }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.1}>
                {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                {label}
            </Typography>
        </Box>
    );
}

interface Props {
    definition: StatDefinition;
    additionalInputType?: StatType;
    dateRange: number;
    periodMode: StatPeriodMode;
    periodOffset: StatPeriodOffset;
    refreshKey: number;
}

function formatAverage(v: number): string {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(1);
}

function pluralDays(n: number): string {
    return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function computeLongestBooleanStreak(entries: StatEntry[]): number {
    const yesDates = entries
        .filter(entry => entry.status !== 'NOT_PLANNED')
        .filter(entry => entry.value === 1)
        .map(entry => entry.date)
        .sort();

    let longest = 0;
    let current = 0;
    let previousDate: string | null = null;
    for (const date of yesDates) {
        current = previousDate && differenceInCalendarDays(parseISO(date), parseISO(previousDate)) === 1
            ? current + 1
            : 1;
        longest = Math.max(longest, current);
        previousDate = date;
    }
    return longest;
}

function previousDate(date: string): string {
    const value = parseISO(date);
    value.setDate(value.getDate() - 1);
    return format(value, 'yyyy-MM-dd');
}

function computeStreak(
    entries: StatEntry[],
    from: string,
    to: string,
    matches: (entry: StatEntry) => boolean,
): number {
    const entriesByDate = new Map(entries.map(entry => [entry.date, entry] as const));
    let cursor = entriesByDate.has(to) ? to : previousDate(to);
    let streak = 0;
    while (cursor >= from) {
        const entry = entriesByDate.get(cursor);
        if (!entry || !matches(entry)) break;
        streak += 1;
        cursor = previousDate(cursor);
    }
    return streak;
}

function optimisticSummary(
    definition: StatDefinition,
    entries: StatEntry[],
    from: string,
    to: string,
    serverSummary: StatSummary,
): StatSummary {
    if (definition.type === 'BOOLEAN') {
        const recordedEntries = entries.filter(entry => entry.status !== 'NOT_PLANNED');
        return {
            ...serverSummary,
            checkInStreak: computeStreak(entries, from, to, () => true),
            periodYesCount: recordedEntries.filter(entry => entry.value === 1).length,
            booleanStreak: computeStreak(
                entries,
                from,
                to,
                entry => entry.status !== 'NOT_PLANNED' && entry.value === 1,
            ),
            longestBooleanStreak: computeLongestBooleanStreak(entries),
        };
    }

    const values = entries.map(entry => entry.value);
    if (values.length === 0) {
        return {
            ...serverSummary,
            checkInStreak: computeStreak(entries, from, to, () => true),
            periodTotal: 0,
            periodHighest: null,
        };
    }

    if (definition.type === 'TIME') {
        const linearValues = values.map(value => timeValueToScale(definition, value));
        const total = linearValues.reduce((sum, value) => sum + value, 0);
        return {
            ...serverSummary,
            checkInStreak: computeStreak(entries, from, to, () => true),
            periodTotal: total,
            periodHighest: timeValueFromScale(definition, Math.max(...linearValues)),
        };
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        ...serverSummary,
        checkInStreak: computeStreak(entries, from, to, () => true),
        periodTotal: total,
        periodHighest: Math.max(...values),
    };
}

function additionalInputEntries(entries: StatEntry[], type: StatType): StatEntry[] {
    return entries.flatMap(entry => {
        const value = entry.status === 'NOT_PLANNED' ? undefined : entry.additionalValues?.[type];
        return value == null ? [] : [{ ...entry, value }];
    });
}

function additionalInputSummary(
    definition: StatDefinition,
    entries: StatEntry[],
    from: string,
    to: string,
): StatSummary {
    const checkInStreak = computeStreak(entries, from, to, () => true);
    const baseSummary: StatSummary = {
        checkInStreak,
        periodYesCount: null,
        booleanStreak: null,
        periodAverage: null,
        periodTotal: null,
        periodHighest: null,
    };
    if (definition.type === 'BOOLEAN') {
        return {
            ...baseSummary,
            periodYesCount: entries.filter(entry => entry.value === 1).length,
            booleanStreak: computeStreak(entries, from, to, entry => entry.value === 1),
            longestBooleanStreak: computeLongestBooleanStreak(entries),
            periodAverage: null,
            periodTotal: null,
            periodHighest: null,
        };
    }

    const values = entries.map(entry => entry.value);
    if (values.length === 0) {
        return {
            ...baseSummary,
            periodAverage: null,
            periodTotal: 0,
        };
    }
    if (definition.type === 'TIME') {
        const linearValues = values.map(value => timeValueToScale(definition, value));
        const total = linearValues.reduce((sum, value) => sum + value, 0);
        return {
            ...baseSummary,
            periodAverage: timeValueFromScale(definition, total / values.length),
            periodTotal: total,
            periodHighest: timeValueFromScale(definition, Math.max(...linearValues)),
        };
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        ...baseSummary,
        periodAverage: total / values.length,
        periodTotal: total,
        periodHighest: Math.max(...values),
    };
}

export const StatSummaryBar = React.memo(function StatSummaryBar({
    definition,
    additionalInputType,
    dateRange,
    periodMode,
    periodOffset,
    refreshKey,
}: Props) {
    const period = getStatPeriodWindow(dateRange, periodMode, periodOffset);
    const { user } = useUser();
    const viewPreferencesKey = statViewPreferencesStorageKey(user?.id, definition.id);
    const [viewPreferencesState, setViewPreferencesState] = useState(() => ({
        key: viewPreferencesKey,
        preferences: readStatViewPreferences(viewPreferencesKey),
    }));
    const viewPreferences = viewPreferencesState.key === viewPreferencesKey
        ? viewPreferencesState.preferences
        : readStatViewPreferences(viewPreferencesKey);
    const updateViewPreferences = (update: Partial<StatViewPreferences>) => {
        const preferences = { ...viewPreferences, ...update };
        writeStatViewPreferences(viewPreferencesKey, preferences);
        setViewPreferencesState({ key: viewPreferencesKey, preferences });
    };
    const periodKey = `${definition.id}:${additionalInputType ?? 'main'}:${period.key}`;
    const [summaryState, setSummaryState] = useState<{ key: string; summary: StatSummary } | null>(() => {
        const summary = statService.getCachedSummary(definition.id, period.from, period.to);
        return summary ? { key: periodKey, summary } : null;
    });
    const [entryState, setEntryState] = useState<{ key: string; entries: StatEntry[] } | null>(() => {
        const entries = statService.getCachedEntries(definition.id, period.from, period.to);
        return entries ? { key: periodKey, entries } : null;
    });
    const forceSummaryRefreshOnMountRef = useRef(true);
    const forceEntriesRefreshOnMountRef = useRef(true);
    const cachedSummary = statService.getCachedSummary(definition.id, period.from, period.to);
    const currentSummary = summaryState?.key === periodKey
        ? summaryState.summary
        : cachedSummary ?? null;
    const currentEntries = statService.getCachedEntries(definition.id, period.from, period.to)
        ?? (entryState?.key === periodKey ? entryState.entries : null);
    // Keep the previous period visible while the next period is loading. This
    // prevents the summary row from collapsing into skeletons on every range change.
    const summary = additionalInputType ? null : currentSummary ?? summaryState?.summary ?? null;
    const entries = currentEntries ?? entryState?.entries ?? null;
    const isRefreshing = !additionalInputType && currentSummary === null && summaryState !== null;
    const displayEntries = entries === null
        ? null
        : additionalInputType ? additionalInputEntries(entries, additionalInputType) : entries;
    const displaySummary = additionalInputType
        ? displayEntries === null ? null : additionalInputSummary(definition, displayEntries, period.from, period.to)
        : summary && entries ? optimisticSummary(definition, entries, period.from, period.to, summary) : summary;

    useEffect(() => {
        if (additionalInputType) return undefined;
        let cancelled = false;
        const forceRefresh = forceSummaryRefreshOnMountRef.current;
        forceSummaryRefreshOnMountRef.current = false;
        const summaryKey = periodKey;
        statService.getSummary(definition.id, period.from, period.to, forceRefresh)
            .then(nextSummary => {
                if (!cancelled) setSummaryState({ key: summaryKey, summary: nextSummary });
            })
            .catch(e => console.error('Failed to fetch stat summary:', e))
        return () => { cancelled = true; };
    }, [additionalInputType, definition.id, period.from, period.key, period.to, periodKey, refreshKey]);

    useEffect(() => {
        let cancelled = false;
        const forceRefresh = forceEntriesRefreshOnMountRef.current;
        forceEntriesRefreshOnMountRef.current = false;
        statService.getEntries(definition.id, period.from, period.to, forceRefresh)
            .then(nextEntries => {
                if (!cancelled) setEntryState({ key: periodKey, entries: nextEntries });
            })
            .catch(e => console.error('Failed to fetch stat entries for summary:', e));
        return () => { cancelled = true; };
    }, [definition.id, period.from, period.to, periodKey, refreshKey]);

    if (!displaySummary) {
        const tileCount = 3;
        return (
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                {Array.from({ length: tileCount }, (_, index) => (
                    <Skeleton key={index} variant="rounded" height={58} sx={{ flex: 1 }} />
                ))}
            </Stack>
        );
    }

    const tiles: TileProps[] = [];
    const values = displayEntries?.map(entry => entry.value) ?? null;
    const canCountUnloggedDays = !additionalInputType && supportsUnloggedDaysAsZero(definition.type, definition.systemKey);
    const countUnloggedDays = canCountUnloggedDays
        && (viewPreferences.countUnloggedDays ?? definition.includeUnloggedDaysAsZero ?? false);
    const zeroDays = countUnloggedDays && values
        ? unloggedDayCount(values.length, summary?.averageStartDate, period.to)
        : 0;
    const averageKind = viewPreferences.averageKind;
    const periodAverage = values
        ? statPeriodAverage(definition, values, averageKind, zeroDays)
        : averageKind === 'mean' ? displaySummary.periodAverage : null;
    const averageTile = (format: (value: number) => string): TileProps => ({
        label: averageKind === 'median' ? 'Median' : 'Average',
        value: periodAverage !== null ? format(periodAverage) : '—',
        onClick: () => updateViewPreferences({ averageKind: averageKind === 'median' ? 'mean' : 'median' }),
        hint: averageKind === 'median' ? 'Show the mean instead' : 'Show the median, which outliers move less',
    });
    const derivedLongestBooleanStreak = displayEntries ? computeLongestBooleanStreak(displayEntries) : null;
    const derivedPeriodHighest = displayEntries && displayEntries.length > 0
        ? definition.type === 'TIME'
            ? displayEntries.reduce((latest, entry) => timeValueToScale(definition, entry.value) > timeValueToScale(definition, latest) ? entry.value : latest, displayEntries[0].value)
            : Math.max(...displayEntries.map(entry => entry.value))
        : null;
    const derivedPeriodEarliest = displayEntries && displayEntries.length > 0
        ? displayEntries.reduce((earliest, entry) => timeValueToScale(definition, entry.value) < timeValueToScale(definition, earliest) ? entry.value : earliest, displayEntries[0].value)
        : null;
    // Additional inputs have no direction of their own, so their best is simply the highest (or earliest).
    const periodBest = additionalInputType
        ? definition.type === 'TIME' ? derivedPeriodEarliest : displaySummary.periodHighest ?? derivedPeriodHighest
        : values ? statPeriodBest(definition, values) : null;
    const bestLabel = additionalInputType && definition.type === 'TIME' ? 'earliest in period' : 'best in period';

    if (definition.type === 'BOOLEAN') {
        tiles.push({
            label: 'streak',
            value: pluralDays(displaySummary.booleanStreak ?? 0),
        });
        tiles.push({
            label: 'performed',
            value: `${displaySummary.periodYesCount ?? 0} ${displaySummary.periodYesCount === 1 ? 'time' : 'times'}`,
        });
        tiles.push({
            label: 'longest streak in period',
            value: pluralDays(displaySummary.longestBooleanStreak ?? derivedLongestBooleanStreak ?? 0),
        });
    }

    if (definition.type === 'NUMBER' || definition.type === 'RANGE') {
        const numericLabel = (value: number) => definition.type === 'NUMBER'
            ? statNumericValueLabel(value, definition.unit)
            : formatAverage(value);
        tiles.push({
            label: bestLabel,
            value: periodBest != null ? numericLabel(periodBest) : '—',
        });
        tiles.push(averageTile(numericLabel));
        tiles.push({
            label: 'Total',
            value: displaySummary.periodTotal !== null ? numericLabel(displaySummary.periodTotal) : '—',
        });
    }

    if (definition.type === 'TIME') {
        const timeLatest = displaySummary.periodHighest ?? derivedPeriodHighest;
        tiles.push({
            label: bestLabel,
            value: periodBest != null ? formatTimeValue(periodBest) : '—',
        });
        tiles.push(averageTile(formatTimeValue));
        tiles.push({
            label: 'latest',
            value: timeLatest != null ? formatTimeValue(timeLatest) : '—',
        });
    }

    if (definition.type === 'DURATION') {
        tiles.push({
            label: bestLabel,
            value: periodBest != null ? formatDurationValue(periodBest) : '—',
        });
        tiles.push(averageTile(formatDurationValue));
        tiles.push({
            label: 'Total',
            value: displaySummary.periodTotal !== null ? formatDurationValue(displaySummary.periodTotal) : '—',
        });
    }

    return (
        <Box sx={{ mb: 2, opacity: isRefreshing ? 0.72 : 1, transition: 'opacity 160ms ease' }}>
            <Stack direction="row" spacing={1.5}>
                {tiles.map(tile => (
                    <SummaryTile key={tile.label} {...tile} />
                ))}
            </Stack>
            {canCountUnloggedDays && (
                <FormControlLabel
                    control={(
                        <Checkbox
                            size="small"
                            checked={countUnloggedDays}
                            onChange={event => updateViewPreferences({ countUnloggedDays: event.target.checked })}
                        />
                    )}
                    label={<Typography variant="caption" color="text.secondary">Count unlogged days as zero</Typography>}
                    title="Days without a value since the first log count as zero in the average"
                    sx={{ mt: 0.5, ml: -0.5 }}
                />
            )}
        </Box>
    );
});
