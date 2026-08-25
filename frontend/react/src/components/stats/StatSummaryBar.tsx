import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
    refreshKey: number;
}

function formatAverage(v: number): string {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(1);
}

function pluralDays(n: number): string {
    return `${n} ${n === 1 ? 'day' : 'days'}`;
}

export function StatSummaryBar({ definition, refreshKey }: Props) {
    const [summaryState, setSummaryState] = useState<{ definitionId: string; summary: StatSummary } | null>(() => {
        const summary = statService.getCachedSummary(definition.id);
        return summary ? { definitionId: definition.id, summary } : null;
    });
    const cachedSummary = statService.getCachedSummary(definition.id);
    const summary = summaryState?.definitionId === definition.id
        ? summaryState.summary
        : cachedSummary ?? null;

    useEffect(() => {
        let cancelled = false;
        statService.getSummary(definition.id)
            .then(nextSummary => {
                if (!cancelled) setSummaryState({ definitionId: definition.id, summary: nextSummary });
            })
            .catch(e => console.error('Failed to fetch stat summary:', e))
        return () => { cancelled = true; };
    }, [definition.id, refreshKey]);

    if (!summary) {
        const tileCount = definition.type === 'BOOLEAN' ? 3 : 2;
        return (
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                {Array.from({ length: tileCount }, (_, index) => (
                    <Skeleton key={index} variant="rounded" height={58} sx={{ flex: 1 }} />
                ))}
            </Stack>
        );
    }

    const tiles: TileProps[] = [];

    tiles.push({
        label: 'Check-in streak',
        value: pluralDays(summary.checkInStreak),
    });

    if (definition.type === 'BOOLEAN') {
        tiles.push({
            label: 'Yes streak',
            value: pluralDays(summary.booleanStreak ?? 0),
        });
        tiles.push({
            label: 'This month',
            value: `${summary.monthlyCheckIns ?? 0} check-ins`,
        });
    }

    if (definition.type === 'NUMBER' || definition.type === 'RANGE') {
        tiles.push({
            label: 'Monthly avg',
            value: summary.monthlyAverage !== null ? formatAverage(summary.monthlyAverage) : '—',
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
