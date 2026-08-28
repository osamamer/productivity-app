import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle,
    FormControl, InputLabel, MenuItem, Paper, Select, Stack, ToggleButton,
    ToggleButtonGroup, Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { format, subDays } from 'date-fns';
import { StatCorrelation, StatDefinition, StatInsights } from '../../types/Stats';
import { statService } from '../../services/api/statService';

const INSIGHT_DATE_RANGES = [
    { label: '30d', value: 30 },
    { label: '3m', value: 90 },
    { label: '1y', value: 365 },
];

interface Props {
    open: boolean;
    onClose: () => void;
    definition: StatDefinition;
    definitions: StatDefinition[];
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
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function RelationshipCard({ correlation, selected, onSelect }: {
    correlation: StatCorrelation;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <Paper
            variant="outlined"
            onClick={onSelect}
            sx={{
                p: 1.5,
                cursor: 'pointer',
                borderColor: selected ? 'primary.main' : undefined,
                bgcolor: selected ? 'action.selected' : undefined,
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography variant="subtitle2">{correlation.statName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {correlation.overlapDays} shared {correlation.overlapDays === 1 ? 'day' : 'days'}
                </Typography>
            </Stack>
            {correlation.meaningful ? (
                <Typography variant="body2" sx={{ mt: 0.75 }}>{correlation.insight}</Typography>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    No clear pattern yet.
                </Typography>
            )}
        </Paper>
    );
}

export function StatInsightsDialog({ open, onClose, definition, definitions }: Props) {
    const [dateRange, setDateRange] = useState(90);
    const [compareId, setCompareId] = useState('');
    const [insights, setInsights] = useState<StatInsights | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const period = useMemo(() => getPeriodWindow(dateRange), [dateRange]);
    const otherDefinitions = useMemo(
        () => definitions.filter(item => item.id !== definition.id),
        [definition.id, definitions],
    );

    useEffect(() => {
        if (!open) return;
        setCompareId(previous => otherDefinitions.some(item => item.id === previous)
            ? previous
            : otherDefinitions[0]?.id ?? '');
    }, [definition.id, open, otherDefinitions]);

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

    const selectedCorrelation = insights?.correlations.find(
        correlation => correlation.statDefinitionId === compareId,
    );
    const meaningfulRelationships = insights?.correlations.filter(correlation => correlation.meaningful) ?? [];

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon color="primary" fontSize="small" />
                Insights about {definition.name}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
                        <FormControl size="small" fullWidth>
                            <InputLabel id="stat-insight-compare-label">Compare with</InputLabel>
                            <Select
                                labelId="stat-insight-compare-label"
                                value={compareId}
                                label="Compare with"
                                onChange={event => setCompareId(event.target.value)}
                                disabled={otherDefinitions.length === 0}
                            >
                                {otherDefinitions.map(item => (
                                    <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>

                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                            <CircularProgress size={28} />
                        </Box>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                    {!loading && !error && otherDefinitions.length === 0 && (
                        <Alert severity="info">
                            Add another stat and log it on a few days to discover relationships.
                        </Alert>
                    )}
                    {!loading && !error && otherDefinitions.length > 0 && selectedCorrelation && (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="overline" color="text.secondary">Selected relationship</Typography>
                            {selectedCorrelation.meaningful ? (
                                <>
                                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                                        {selectedCorrelation.insight}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                                        <Typography variant="caption" color="text.secondary">
                                            Correlation r = {formatCorrelation(selectedCorrelation.correlation)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            · {selectedCorrelation.strength.toLowerCase()} signal
                                        </Typography>
                                        {selectedCorrelation.otherAverageWhenDriverHigher !== null &&
                                            selectedCorrelation.otherAverageWhenDriverLower !== null && (
                                                <Typography variant="caption" color="text.secondary">
                                                    · {formatAverage(selectedCorrelation.otherAverageWhenDriverHigher, selectedCorrelation.statType)} vs {formatAverage(selectedCorrelation.otherAverageWhenDriverLower, selectedCorrelation.statType)} average
                                                </Typography>
                                            )}
                                    </Stack>
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {selectedCorrelation.insight}
                                </Typography>
                            )}
                        </Paper>
                    )}
                    {!loading && !error && otherDefinitions.length > 0 && !selectedCorrelation && (
                        <Alert severity="info">There is no shared data for this comparison yet.</Alert>
                    )}

                    {!loading && !error && meaningfulRelationships.length > 1 && (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Other meaningful relationships</Typography>
                            {meaningfulRelationships
                                .filter(correlation => correlation.statDefinitionId !== compareId)
                                .slice(0, 3)
                                .map(correlation => (
                                    <RelationshipCard
                                        key={correlation.statDefinitionId}
                                        correlation={correlation}
                                        selected={false}
                                        onSelect={() => setCompareId(correlation.statDefinitionId)}
                                    />
                                ))}
                        </Stack>
                    )}
                    {!loading && !error && insights && meaningfulRelationships.length === 0 && otherDefinitions.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                            Keep logging both stats. Insights appear when there are at least five shared days with a consistent pattern.
                        </Typography>
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
