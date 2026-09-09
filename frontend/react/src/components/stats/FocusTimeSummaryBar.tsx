import React, { useEffect, useState } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, subDays } from 'date-fns';
import { StatFocusTimeEntry } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { formatDurationValue } from '../../services/utils/statValues';

interface Props {
    definitionId: string;
    dateRange: number;
    refreshKey: number;
}

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
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.1}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                {label}
            </Typography>
        </Box>
    );
}

function getPeriodWindow(dateRange: number): { from: string; to: string; key: string } {
    const to = new Date();
    const from = subDays(to, dateRange - 1);
    const fromString = format(from, 'yyyy-MM-dd');
    const toString = format(to, 'yyyy-MM-dd');
    return { from: fromString, to: toString, key: `${fromString}:${toString}` };
}

function minutesFrom(entries: StatFocusTimeEntry[]): number[] {
    return entries.map(entry => entry.totalFocusSeconds / 60);
}

export const FocusTimeSummaryBar = React.memo(function FocusTimeSummaryBar({
    definitionId,
    dateRange,
    refreshKey,
}: Props) {
    const period = getPeriodWindow(dateRange);
    const periodKey = `${definitionId}:${period.key}`;
    const [state, setState] = useState<{ key: string; entries: StatFocusTimeEntry[] } | null>(() => {
        const entries = statService.getCachedFocusTime(definitionId, period.from, period.to);
        return entries ? { key: periodKey, entries } : null;
    });
    const cachedEntries = statService.getCachedFocusTime(definitionId, period.from, period.to);
    const currentEntries = state?.key === periodKey ? state.entries : cachedEntries ?? null;
    const entries = currentEntries ?? state?.entries ?? null;
    const isRefreshing = currentEntries === null && state !== null;

    useEffect(() => {
        let cancelled = false;
        statService.getFocusTime(definitionId, period.from, period.to)
            .then(nextEntries => {
                if (!cancelled) setState({ key: periodKey, entries: nextEntries });
            })
            .catch(error => console.error('Failed to fetch task focus time summary:', error));
        return () => { cancelled = true; };
    }, [definitionId, period.from, period.key, period.to, periodKey, refreshKey]);

    if (!entries) {
        return (
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                {[0, 1, 2].map(item => <Skeleton key={item} variant="rounded" height={58} sx={{ flex: 1 }} />)}
            </Stack>
        );
    }

    const values = minutesFrom(entries);
    const total = values.reduce((sum, value) => sum + value, 0);
    const highest = values.length > 0 ? Math.max(...values) : null;
    const average = values.length > 0 ? total / values.length : null;
    const tiles: TileProps[] = [
        { label: 'Highest', value: highest === null ? '—' : formatDurationValue(highest) },
        { label: 'Average', value: average === null ? '—' : formatDurationValue(average) },
        { label: 'Total', value: formatDurationValue(total) },
    ];

    return (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, opacity: isRefreshing ? 0.72 : 1, transition: 'opacity 160ms ease' }}>
            {tiles.map(tile => <SummaryTile key={tile.label} {...tile} />)}
        </Stack>
    );
});
