import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { StatDefinition, StatEntry, StatSummary } from '../../types/Stats';
import { statService } from '../../services/api/statService';

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

function getPeriodWindow(dateRange: number): { from: string; to: string; key: string } {
    const to = new Date();
    const from = subDays(to, dateRange - 1);
    return {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
        key: `${format(from, 'yyyy-MM-dd')}:${format(to, 'yyyy-MM-dd')}`,
    };
}

export function StatSummaryBar({ definition, dateRange, refreshKey }: Props) {
    const period = getPeriodWindow(dateRange);
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
    const summary = summaryState?.key === periodKey
        ? summaryState.summary
        : cachedSummary ?? null;
    const entries = entryState?.key === periodKey ? entryState.entries : null;

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

    if (!summary) {
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
        ? Math.max(...entries.map(entry => entry.value))
        : null;
    const periodHighest = summary.periodHighest ?? derivedPeriodHighest;

    if (definition.type === 'BOOLEAN') {
        tiles.push({
            label: 'streak',
            value: pluralDays(summary.booleanStreak ?? 0),
        });
        tiles.push({
            label: 'performed',
            value: `${summary.periodYesCount ?? 0} ${summary.periodYesCount === 1 ? 'time' : 'times'}`,
        });
        tiles.push({
            label: 'longest streak',
            value: pluralDays(summary.longestBooleanStreak ?? derivedLongestBooleanStreak ?? 0),
        });
    }

    if (definition.type === 'NUMBER' || definition.type === 'RANGE') {
        tiles.push({
            label: 'Highest',
            value: periodHighest != null ? formatAverage(periodHighest) : '—',
        });
        tiles.push({
            label: 'Average',
            value: summary.periodAverage !== null ? formatAverage(summary.periodAverage) : '—',
        });
        tiles.push({
            label: 'Total',
            value: summary.periodTotal !== null ? formatAverage(summary.periodTotal) : '—',
        });
    }

    return (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            {tiles.map(t => (
                <SummaryTile key={t.label} label={t.label} value={t.value} />
            ))}
        </Stack>
    );
}
