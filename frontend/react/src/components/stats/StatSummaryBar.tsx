import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, subDays } from 'date-fns';
import { StatDefinition, StatSummary } from '../../types/Stats';
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

function getPeriodWindow(dateRange: number): { from: string; to: string; key: string } {
    const to = new Date();
    const from = subDays(to, dateRange - 1);
    return {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
        key: `${format(from, 'yyyy-MM-dd')}:${format(to, 'yyyy-MM-dd')}`,
    };
}

function formatPeriod(dateRange: number): string {
    switch (dateRange) {
        case 7: return '7d';
        case 30: return '30d';
        case 90: return '3m';
        case 365: return '1y';
        default: return `${dateRange}d`;
    }
}

export function StatSummaryBar({ definition, dateRange, refreshKey }: Props) {
    const period = getPeriodWindow(dateRange);
    const [summaryState, setSummaryState] = useState<{ key: string; summary: StatSummary } | null>(() => {
        const summary = statService.getCachedSummary(definition.id, period.from, period.to);
        return summary ? { key: `${definition.id}:${period.key}`, summary } : null;
    });
    const cachedSummary = statService.getCachedSummary(definition.id, period.from, period.to);
    const summary = summaryState?.key === `${definition.id}:${period.key}`
        ? summaryState.summary
        : cachedSummary ?? null;

    useEffect(() => {
        let cancelled = false;
        const summaryKey = `${definition.id}:${period.key}`;
        statService.getSummary(definition.id, period.from, period.to)
            .then(nextSummary => {
                if (!cancelled) setSummaryState({ key: summaryKey, summary: nextSummary });
            })
            .catch(e => console.error('Failed to fetch stat summary:', e))
        return () => { cancelled = true; };
    }, [definition.id, period.from, period.key, period.to, refreshKey]);

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
    const periodLabel = formatPeriod(dateRange);

    tiles.push({
        label: `Check-in streak · ${periodLabel}`,
        value: pluralDays(summary.checkInStreak),
    });

    if (definition.type === 'BOOLEAN') {
        tiles.push({
            label: `Yes streak · ${periodLabel}`,
            value: pluralDays(summary.booleanStreak ?? 0),
        });
        tiles.push({
            label: `Yes · ${periodLabel}`,
            value: String(summary.periodYesCount ?? 0),
        });
    }

    if (definition.type === 'NUMBER' || definition.type === 'RANGE') {
        tiles.push({
            label: `Average · ${periodLabel}`,
            value: summary.periodAverage !== null ? formatAverage(summary.periodAverage) : '—',
        });
        tiles.push({
            label: `Total · ${periodLabel}`,
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
