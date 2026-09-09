import React, { useEffect, useRef, useState } from 'react';
import {
    Box, Card, CardContent, CardHeader, IconButton,
    FormControl, InputLabel, MenuItem, Select, Stack,
    ToggleButton, Tooltip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { format, subDays } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { StatLineChart } from './StatLineChart';
import { BooleanCalendarView } from './BooleanCalendarView';
import { StatSummaryBar } from './StatSummaryBar';
import { StatInsightsDialog } from './StatInsightsDialog';
import { FocusTimeSummaryBar } from './FocusTimeSummaryBar';
import { TaskFocusTimeChart } from './TaskFocusTimeChart';

const CHART_DATE_RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '3m', value: 90 },
    { label: '1y', value: 365 },
];

const CALENDAR_DATE_RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
];

interface StatViewTransitionProps {
    viewKey: string;
    children: React.ReactNode;
}

function StatViewTransition({ viewKey, children }: StatViewTransitionProps) {
    const previousViewKey = useRef<string | null>(null);
    const animate = previousViewKey.current !== null && previousViewKey.current !== viewKey;

    useEffect(() => {
        previousViewKey.current = viewKey;
    }, [viewKey]);

    return (
        <Box
            key={viewKey}
            sx={animate ? {
                animation: 'statViewEnter 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                '@keyframes statViewEnter': {
                    from: { opacity: 0, transform: 'translateY(8px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                },
                '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                },
            } : undefined}
        >
            {children}
        </Box>
    );
}

interface Props {
    definition: StatDefinition;
    comparisonDefinitions: StatDefinition[];
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

export const StatCard = React.memo(function StatCard({
    definition,
    comparisonDefinitions,
    refreshKey,
    onEntryChanged,
    onDateContextMenu,
}: Props) {
    const [dateRange, setDateRange] = useState(30);
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [insightsAvailable, setInsightsAvailable] = useState(false);
    const [comparisonId, setComparisonId] = useState('');
    const supportsComparison = definition.type !== 'TIME' && definition.type !== 'DURATION';
    const availableComparisons = supportsComparison
        ? comparisonDefinitions.filter(item => item.id !== definition.id)
        : [];
    const comparisonDefinition = supportsComparison
        ? availableComparisons.find(item => item.id === comparisonId)
        : undefined;
    const supportsFocusTime = Boolean(definition.recurringTaskSeriesId);
    const [viewMode, setViewMode] = useState<'stat' | 'focusTime'>('stat');
    const focusTimeView = supportsFocusTime && viewMode === 'focusTime';
    const comparisonIds = comparisonDefinitions.map(item => item.id).join(':');
    const isBooleanCalendar = !focusTimeView && definition.type === 'BOOLEAN' && !comparisonDefinition;
    const effectiveDateRange = isBooleanCalendar ? Math.min(dateRange, 30) : dateRange;

    useEffect(() => {
        if (!supportsFocusTime && viewMode !== 'stat') setViewMode('stat');
        if (focusTimeView && comparisonId) setComparisonId('');
    }, [comparisonId, focusTimeView, supportsFocusTime, viewMode]);

    useEffect(() => {
        let cancelled = false;
        const to = new Date();
        const from = subDays(to, 89);
        statService.getInsights(
            definition.id,
            format(from, 'yyyy-MM-dd'),
            format(to, 'yyyy-MM-dd'),
        )
            .then(insights => {
                if (!cancelled) {
                    setInsightsAvailable(insights.correlations.some(correlation => correlation.meaningful));
                }
            })
            .catch(error => {
                console.error('Failed to check stat insights availability:', error);
                if (!cancelled) setInsightsAvailable(false);
            });

        return () => { cancelled = true; };
    }, [comparisonDefinitions.length, comparisonIds, definition.id, refreshKey]);

    useEffect(() => {
        const comparisonStillAvailable = comparisonDefinitions.some(
            item => item.id === comparisonId && item.id !== definition.id,
        );
        if (comparisonId && !comparisonStillAvailable) {
            setComparisonId('');
        }
    }, [comparisonDefinitions, comparisonId, definition.id]);

    useEffect(() => {
        if (isBooleanCalendar && dateRange > 30) {
            setDateRange(30);
        }
    }, [dateRange, isBooleanCalendar]);

    const dateRanges = isBooleanCalendar
        ? CALENDAR_DATE_RANGES
        : CHART_DATE_RANGES;

    return (
        <Card variant="outlined">
            <CardHeader
                avatar={insightsAvailable ? (
                    <Tooltip title={`See insights about this statistic`}>
                        <IconButton
                            aria-label={`See insights about this statistic`}
                            onClick={() => setInsightsOpen(true)}
                            size="small"
                            color="primary"
                        >
                            <AutoAwesomeIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ) : undefined}
                title={definition.name}
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                subheader={definition.description}
                subheaderTypographyProps={{ variant: 'caption' }}
                sx={{ pb: 0, minHeight: 72 }}
            />
            <CardContent>
                {focusTimeView ? (
                    <FocusTimeSummaryBar
                        definitionId={definition.id}
                        dateRange={effectiveDateRange}
                        refreshKey={refreshKey}
                    />
                ) : (
                    <StatSummaryBar definition={definition} dateRange={effectiveDateRange} refreshKey={refreshKey} />
                )}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    spacing={1.5}
                    sx={{ mb: 2 }}
                >
                    <Stack direction="row" spacing={0.5}>
                        {dateRanges.map(r => (
                            <ToggleButton
                                key={r.value}
                                value={r.value}
                                selected={effectiveDateRange === r.value}
                                onChange={() => setDateRange(r.value)}
                                size="small"
                                sx={{ px: 1.5, py: 0.25, fontSize: 12, lineHeight: 1.5 }}
                            >
                                {r.label}
                            </ToggleButton>
                        ))}
                    </Stack>
                    {(supportsFocusTime || supportsComparison) && (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {supportsFocusTime && (
                                <FormControl size="small" sx={{ minWidth: { sm: 180 } }}>
                                    <InputLabel id={`stat-view-label-${definition.id}`}>View</InputLabel>
                                    <Select
                                        labelId={`stat-view-label-${definition.id}`}
                                        value={viewMode}
                                        label="View"
                                        onChange={event => setViewMode(event.target.value as 'stat' | 'focusTime')}
                                        inputProps={{ 'aria-label': `View ${definition.name}` }}
                                    >
                                        <MenuItem value="stat">Stat value</MenuItem>
                                        <MenuItem value="focusTime">Focus time</MenuItem>
                                    </Select>
                                </FormControl>
                            )}
                            {supportsComparison && (
                                <FormControl size="small" sx={{ minWidth: { sm: 220 } }} disabled={availableComparisons.length === 0 || focusTimeView}>
                                    <InputLabel id="stat-overlay-label">Overlay stat</InputLabel>
                                    <Select
                                        labelId="stat-overlay-label"
                                        value={comparisonId}
                                        label="Overlay stat"
                                        onChange={event => setComparisonId(event.target.value)}
                                        inputProps={{ 'aria-label': `Overlay another stat on ${definition.name}` }}
                                    >
                                        <MenuItem value="">None</MenuItem>
                                        {availableComparisons.map(item => (
                                            <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        </Stack>
                    )}
                </Stack>
                <StatViewTransition
                    viewKey={focusTimeView ? 'focus-time' : isBooleanCalendar ? 'calendar' : 'chart'}
                >
                    {focusTimeView ? (
                        <TaskFocusTimeChart
                            definition={definition}
                            dateRange={effectiveDateRange}
                            refreshKey={refreshKey}
                        />
                    ) : isBooleanCalendar ? (
                        <BooleanCalendarView
                            definition={definition}
                            dateRange={effectiveDateRange}
                            refreshKey={refreshKey}
                            onEntryChanged={onEntryChanged}
                            onDateContextMenu={onDateContextMenu}
                        />
                    ) : (
                        <StatLineChart
                            definition={definition}
                            comparisonDefinition={comparisonDefinition}
                            dateRange={effectiveDateRange}
                            refreshKey={refreshKey}
                            onEntryChanged={onEntryChanged}
                            onDateContextMenu={onDateContextMenu}
                        />
                    )}
                </StatViewTransition>
            </CardContent>
            <StatInsightsDialog
                open={insightsOpen}
                onClose={() => setInsightsOpen(false)}
                definition={definition}
            />
        </Card>
    );
});
