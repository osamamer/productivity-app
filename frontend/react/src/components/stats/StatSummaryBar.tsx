import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { StatDefinition, StatEntry, StatSummary } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';
import {
    averageTimeValues,
    formatDurationValue,
    formatTimeValue,
    timeValueFromScale,
    timeValueToScale,
} from '../../services/utils/statValues';

interface TileProps {
    label: string;
    value: string;
}

function SummaryTile({ label, value }: TileProps) {
    const theme = useTheme();
    return (
        <Box sx={{
            flex: 1,
            textAlign: 'center',
            py: 1.25,
            px: 1,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
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
            periodAverage: null,
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
            periodAverage: timeValueFromScale(definition, total / values.length),
            periodTotal: total,
            periodHighest: timeValueFromScale(definition, Math.max(...linearValues)),
        };
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    const periodDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    const serverUsesUnloggedZeros = serverSummary.periodAverage != null
        && serverSummary.periodTotal != null
        && Math.abs(serverSummary.periodAverage - serverSummary.periodTotal / periodDays) < 0.000001;
    return {
        ...serverSummary,
        checkInStreak: computeStreak(entries, from, to, () => true),
        periodAverage: total / (serverUsesUnloggedZeros ? periodDays : values.length),
        periodTotal: total,
        periodHighest: Math.max(...values),
    };
}

export const StatSummaryBar = React.memo(function StatSummaryBar({ definition, dateRange, periodMode, periodOffset, refreshKey }: Props) {
    const period = getStatPeriodWindow(dateRange, periodMode, periodOffset);
    const periodKey = `${definition.id}:${period.key}`;
    const [summaryState, setSummaryState] = useState<{ key: string; summary: StatSummary } | null>(() => {
        const summary = statService.getCachedSummary(definition.id, period.from, period.to);
        return summary ? { key: periodKey, summary } : null;
    });
    const [entryState, setEntryState] = useState<{ key: string; entries: StatEntry[] } | null>(() => {
        const entries = statService.getCachedEntries(definition.id, period.from, period.to);
        return entries ? { key: periodKey, entries } : null;
    });
    const cachedSummary = statService.getCachedSummary(definition.id, period.from, period.to);
    const currentSummary = summaryState?.key === periodKey
        ? summaryState.summary
        : cachedSummary ?? null;
    const currentEntries = statService.getCachedEntries(definition.id, period.from, period.to)
        ?? (entryState?.key === periodKey ? entryState.entries : null);
    // Keep the previous period visible while the next period is loading. This
    // prevents the summary row from collapsing into skeletons on every range change.
    const summary = currentSummary ?? summaryState?.summary ?? null;
    const entries = currentEntries ?? entryState?.entries ?? null;
    const isRefreshing = currentSummary === null && summaryState !== null;
    const displaySummary = summary && entries
        ? optimisticSummary(definition, entries, period.from, period.to, summary)
        : summary;

    useEffect(() => {
        let cancelled = false;
        const summaryKey = periodKey;
        statService.getSummary(definition.id, period.from, period.to)
            .then(nextSummary => {
                if (!cancelled) setSummaryState({ key: summaryKey, summary: nextSummary });
            })
            .catch(e => console.error('Failed to fetch stat summary:', e))
        return () => { cancelled = true; };
    }, [definition.id, period.from, period.key, period.to, periodKey, refreshKey]);

    useEffect(() => {
        let cancelled = false;
        statService.getEntries(definition.id, period.from, period.to)
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
    const derivedLongestBooleanStreak = entries ? computeLongestBooleanStreak(entries) : null;
    const derivedPeriodHighest = entries && entries.length > 0
        ? definition.type === 'TIME'
            ? entries.reduce((latest, entry) => timeValueToScale(definition, entry.value) > timeValueToScale(definition, latest) ? entry.value : latest, entries[0].value)
            : Math.max(...entries.map(entry => entry.value))
        : null;
    const derivedPeriodEarliest = entries && entries.length > 0
        ? entries.reduce((earliest, entry) => timeValueToScale(definition, entry.value) < timeValueToScale(definition, earliest) ? entry.value : earliest, entries[0].value)
        : null;
    const periodHighest = displaySummary.periodHighest ?? derivedPeriodHighest;

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
            label: 'longest streak',
            value: pluralDays(displaySummary.longestBooleanStreak ?? derivedLongestBooleanStreak ?? 0),
        });
    }

    if (definition.type === 'NUMBER' || definition.type === 'RANGE') {
        tiles.push({
            label: 'Highest',
            value: periodHighest != null ? formatAverage(periodHighest) : '—',
        });
        tiles.push({
            label: 'Average',
            value: displaySummary.periodAverage !== null ? formatAverage(displaySummary.periodAverage) : '—',
        });
        tiles.push({
            label: 'Total',
            value: displaySummary.periodTotal !== null ? formatAverage(displaySummary.periodTotal) : '—',
        });
    }

    if (definition.type === 'TIME') {
        const timeAverage = displaySummary.periodAverage
            ?? (entries ? averageTimeValues(definition, entries.map(entry => entry.value)) : null);
        const timeLatest = displaySummary.periodHighest ?? derivedPeriodHighest;
        tiles.push({
            label: 'Earliest',
            value: derivedPeriodEarliest != null ? formatTimeValue(derivedPeriodEarliest) : '—',
        });
        tiles.push({
            label: 'Average',
            value: timeAverage !== null ? formatTimeValue(timeAverage) : '—',
        });
        tiles.push({
            label: 'Latest',
            value: timeLatest != null ? formatTimeValue(timeLatest) : '—',
        });
    }

    if (definition.type === 'DURATION') {
        tiles.push({
            label: 'Highest',
            value: periodHighest != null ? formatDurationValue(periodHighest) : '—',
        });
        tiles.push({
            label: 'Average',
            value: displaySummary.periodAverage !== null ? formatDurationValue(displaySummary.periodAverage) : '—',
        });
        tiles.push({
            label: 'Total',
            value: displaySummary.periodTotal !== null ? formatDurationValue(displaySummary.periodTotal) : '—',
        });
    }

    return (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, opacity: isRefreshing ? 0.72 : 1, transition: 'opacity 160ms ease' }}>
            {tiles.map(t => (
                <SummaryTile key={t.label} label={t.label} value={t.value} />
            ))}
        </Stack>
    );
});
