import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle,
    Paper, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { format, subDays } from 'date-fns';
import { StatCorrelation, StatDefinition, StatInsights } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { formatDurationValue, formatTimeValue } from '../../services/utils/statValues';

const INSIGHT_DATE_RANGES = [
    { label: '30d', value: 30 },
    { label: '3m', value: 90 },
    { label: '1y', value: 365 },
];

interface Props {
    open: boolean;
    onClose: () => void;
    definition: StatDefinition;
}

function getPeriodWindow(dateRange: number): { from: string; to: string } {
    const to = new Date();
    return {
        from: format(subDays(to, dateRange - 1), 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
    };
}

function formatCorrelation(correlation: number | null): string {
    return correlation === null ? '—' : correlation.toFixed(2);
}

function formatAverage(value: number | null, type: StatCorrelation['statType']): string {
    if (value === null) return '—';
    if (type === 'BOOLEAN') return `${Math.round(value * 100)}%`;
    if (type === 'TIME') return formatTimeValue(value);
    if (type === 'DURATION') return formatDurationValue(value);
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function RelationshipCard({ correlation }: {
    correlation: StatCorrelation;
}) {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 1.5,
            }}
        >
            <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography variant="subtitle2">{correlation.statName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {correlation.overlapDays} shared {correlation.overlapDays === 1 ? 'day' : 'days'}
                </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.75 }}>{correlation.insight}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary">
                    Correlation r = {formatCorrelation(correlation.correlation)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    · {correlation.strength.toLowerCase()} signal
                </Typography>
                {correlation.otherAverageWhenDriverHigher !== null &&
                    correlation.otherAverageWhenDriverLower !== null && (
                        <Typography variant="caption" color="text.secondary">
                            · {formatAverage(correlation.otherAverageWhenDriverHigher, correlation.statType)} vs {formatAverage(correlation.otherAverageWhenDriverLower, correlation.statType)} average
                        </Typography>
                    )}
            </Stack>
        </Paper>
    );
}

export function StatInsightsDialog({ open, onClose, definition }: Props) {
    const [dateRange, setDateRange] = useState(90);
    const [insights, setInsights] = useState<StatInsights | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const period = useMemo(() => getPeriodWindow(dateRange), [dateRange]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        statService.getInsights(definition.id, period.from, period.to)
            .then(nextInsights => {
                if (!cancelled) setInsights(nextInsights);
            })
            .catch(fetchError => {
                console.error('Failed to fetch stat insights:', fetchError);
                if (!cancelled) setError('Failed to load insights. Please try again.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [definition.id, open, period.from, period.to]);

    const meaningfulRelationships = insights?.correlations.filter(correlation => correlation.meaningful) ?? [];

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon color="primary" fontSize="small" />
                Insights about {definition.name}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={0.5}>
                        <ToggleButtonGroup
                            exclusive
                            value={dateRange}
                            onChange={(_, value: number | null) => value !== null && setDateRange(value)}
                            size="small"
                            sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
                        >
                            {INSIGHT_DATE_RANGES.map(range => (
                                <ToggleButton key={range.value} value={range.value} sx={{ px: 1.5 }}>
                                    {range.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Stack>

                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                            <CircularProgress size={28} />
                        </Box>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                    {!loading && !error && insights && meaningfulRelationships.length > 0 && (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">
                                {meaningfulRelationships.length === 1 ? 'Insight' : 'Insights'}
                            </Typography>
                            {meaningfulRelationships
                                .map(correlation => (
                                    <RelationshipCard
                                        key={correlation.statDefinitionId}
                                        correlation={correlation}
                                    />
                                ))}
                        </Stack>
                    )}
                    {!loading && !error && insights && meaningfulRelationships.length === 0 && (
                        <Alert severity="info">
                            No meaningful relationships found for this period. Keep logging multiple stats to discover patterns.
                        </Alert>
                    )}
                    {!loading && !error && insights && (
                        <Typography variant="caption" color="text.secondary">
                            Based on {insights.recordedDays} logged {insights.recordedDays === 1 ? 'day' : 'days'} for {definition.name} from {format(new Date(insights.from + 'T12:00:00'), 'MMM d')} to {format(new Date(insights.to + 'T12:00:00'), 'MMM d, yyyy')}. These are personal associations, not proof that one stat causes another.
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
