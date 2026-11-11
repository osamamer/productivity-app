import React, { useEffect, useRef, useState } from 'react';
import {
    Box, Card, CardContent, CardHeader, IconButton,
    FormControl, InputLabel, MenuItem, Select, Stack,
    ToggleButton, Tooltip, Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { format, subDays } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { StatLineChart } from './StatLineChart';
import { BooleanCalendarView } from './BooleanCalendarView';
import { StatSummaryBar } from './StatSummaryBar';
import { StatInsightsDialog } from './StatInsightsDialog';
import { FocusTimeSummaryBar } from './FocusTimeSummaryBar';
import { TaskFocusTimeChart } from './TaskFocusTimeChart';
import { getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';

const CHART_DATE_RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '3m', value: 90 },
    { label: '1y', value: 365 },
];

const CALENDAR_DATE_RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '3m', value: 90 },
    { label: '1y', value: 365 },
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
    subStatDefinitions?: StatDefinition[];
    comparisonDefinitions: StatDefinition[];
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onError?: (message: string) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

export const StatCard = React.memo(function StatCard({
    definition,
    subStatDefinitions = [],
    comparisonDefinitions,
    refreshKey,
    onEntryChanged,
    onError,
    onDateContextMenu,
}: Props) {
    const [dateRange, setDateRange] = useState(30);
    const [periodMode, setPeriodMode] = useState<StatPeriodMode>('last');
    const [periodOffset, setPeriodOffset] = useState<StatPeriodOffset>(0);
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [insightsAvailable, setInsightsAvailable] = useState(false);
    const [comparisonId, setComparisonId] = useState('');
    const supportsFocusTime = Boolean(
        definition.recurringTaskSeriesId
        || definition.focusTaskNames?.length
        || definition.focusTaskName,
    );
    const [displaySelection, setDisplaySelection] = useState<{
        parentId: string;
        metricId: string;
        focusTime: boolean;
    }>({ parentId: definition.id, metricId: definition.id, focusTime: false });
    const currentDisplaySelection = displaySelection.parentId === definition.id
        ? displaySelection
        : { parentId: definition.id, metricId: definition.id, focusTime: false };
    const displayDefinition = subStatDefinitions.find(item => item.id === currentDisplaySelection.metricId)
        ?? definition;
    const focusTimeView = supportsFocusTime && currentDisplaySelection.focusTime;
    const supportsComparison = !focusTimeView && displayDefinition.type !== 'TIME' && displayDefinition.type !== 'DURATION';
    const hasDisplayOptions = supportsFocusTime || subStatDefinitions.length > 0;
    const availableComparisons = supportsComparison
        ? comparisonDefinitions.filter(item => item.id !== displayDefinition.id)
        : [];
    const comparisonDefinition = availableComparisons.find(item => item.id === comparisonId);
    const comparisonIds = comparisonDefinitions.map(item => item.id).join(':');
    const isBooleanCalendar = !focusTimeView && displayDefinition.type === 'BOOLEAN' && !comparisonDefinition;

    useEffect(() => {
        if (focusTimeView && comparisonId) setComparisonId('');
    }, [comparisonId, focusTimeView]);

    useEffect(() => {
        let cancelled = false;
        const to = new Date();
        const from = subDays(to, 89);
        statService.getInsights(
            displayDefinition.id,
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
    }, [comparisonDefinitions.length, comparisonIds, displayDefinition.id, refreshKey]);

    useEffect(() => {
        const comparisonStillAvailable = comparisonDefinitions.some(
            item => item.id === comparisonId && item.id !== displayDefinition.id,
        );
        if (comparisonId && !comparisonStillAvailable) {
            setComparisonId('');
        }
    }, [comparisonDefinitions, comparisonId, displayDefinition.id]);

    const dateRanges = isBooleanCalendar
        ? CALENDAR_DATE_RANGES
        : CHART_DATE_RANGES;
    const supportsPeriodNavigation = dateRange !== 90;
    const periodName = dateRange === 7 ? 'week' : dateRange === 30 ? 'month' : 'year';
    const periodWindow = getStatPeriodWindow(dateRange, periodMode, periodOffset);

    const handleDateRangeChange = (nextDateRange: number) => {
        setDateRange(nextDateRange);
        if (nextDateRange === 90) {
            setPeriodMode('last');
            setPeriodOffset(0);
        }
    };

    const handlePreviousPeriod = () => {
        if (!supportsPeriodNavigation) return;
        setPeriodMode('current');
        setPeriodOffset(current => current - 1);
    };

    const handleNextPeriod = () => {
        if (!supportsPeriodNavigation || periodMode !== 'current' || periodOffset >= 0) return;
        setPeriodOffset(current => Math.min(0, current + 1));
    };

    const showCurrentPeriod = () => {
        setPeriodMode(current => current === 'current' && periodOffset === 0 ? 'last' : 'current');
        setPeriodOffset(0);
    };

    return (
        <Card variant="outlined" sx={{ containerType: 'inline-size' }}>
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
                sx={{ pb: 0, minHeight: 72 }}
            />
            <CardContent>
                {focusTimeView ? (
                    <FocusTimeSummaryBar
                        definitionId={definition.id}
                        dateRange={dateRange}
                        periodMode={periodMode}
                        periodOffset={periodOffset}
                        refreshKey={refreshKey}
                    />
                ) : (
                    <StatSummaryBar
                        definition={displayDefinition}
                        dateRange={dateRange}
                        periodMode={periodMode}
                        periodOffset={periodOffset}
                        refreshKey={refreshKey}
                    />
                )}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr)',
                        alignItems: 'center',
                        gap: 1.5,
                        mb: 2,
                        '@container (min-width: 900px)': {
                            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                        },
                    }}
                >
                    <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ justifySelf: 'start', minWidth: 0 }}
                    >
                        {dateRanges.map(r => (
                            <ToggleButton
                                key={r.value}
                                value={r.value}
                                selected={dateRange === r.value}
                                onChange={() => handleDateRangeChange(r.value)}
                                size="small"
                                sx={{ px: 1.5, py: 0.25, fontSize: 12, lineHeight: 1.5 }}
                            >
                                {r.label}
                            </ToggleButton>
                        ))}
                        {supportsPeriodNavigation && (
                            <>
                                <Tooltip title={`Previous ${periodName}`}>
                                    <IconButton
                                        aria-label={`Previous ${periodName}`}
                                        onClick={handlePreviousPeriod}
                                        size="small"
                                    >
                                        <ChevronLeftIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={`Next ${periodName}`}>
                                    <span>
                                        <IconButton
                                            aria-label={`Next ${periodName}`}
                                            onClick={handleNextPeriod}
                                            disabled={periodMode !== 'current' || periodOffset >= 0}
                                            size="small"
                                        >
                                            <ChevronRightIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <ToggleButton
                                    value="current"
                                    selected={periodMode === 'current' && periodOffset === 0}
                                    onChange={showCurrentPeriod}
                                    size="small"
                                    sx={{ px: 1.5, py: 0.25, fontSize: 12, lineHeight: 1.5 }}
                                >
                                    Current
                                </ToggleButton>
                            </>
                        )}
                    </Stack>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            gridColumn: 1,
                            gridRow: 2,
                            justifySelf: 'center',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            '@container (min-width: 900px)': {
                                gridColumn: 2,
                                gridRow: 1,
                            },
                        }}
                    >
                        {periodWindow.label}
                    </Typography>
                    {(hasDisplayOptions || supportsComparison) && (
                        <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                            justifyContent="flex-end"
                            sx={{
                                gridColumn: 1,
                                gridRow: 3,
                                justifySelf: 'stretch',
                                minWidth: 0,
                                width: '100%',
                                '@container (min-width: 900px)': {
                                    gridColumn: 3,
                                    gridRow: 1,
                                    justifySelf: 'end',
                                    width: 'auto',
                                    maxWidth: '100%',
                                },
                            }}
                        >
                            {hasDisplayOptions && (
                                <FormControl
                                    size="small"
                                    sx={{
                                        flex: '1 1 220px',
                                        minWidth: 0,
                                        '@container (min-width: 900px)': { minWidth: 220 },
                                    }}
                                >
                                    <InputLabel id={`stat-display-label-${definition.id}`}>Display</InputLabel>
                                    <Select
                                        labelId={`stat-display-label-${definition.id}`}
                                        value={focusTimeView ? 'focusTime' : displayDefinition.id}
                                        label="Display"
                                        onChange={event => {
                                            const nextValue = event.target.value;
                                            if (nextValue === 'focusTime') {
                                                setDisplaySelection({
                                                    parentId: definition.id,
                                                    metricId: definition.id,
                                                    focusTime: true,
                                                });
                                                return;
                                            }
                                            setDisplaySelection({
                                                parentId: definition.id,
                                                metricId: nextValue,
                                                focusTime: false,
                                            });
                                        }}
                                        inputProps={{ 'aria-label': `Display value for ${definition.name}` }}
                                    >
                                        <MenuItem value={definition.id}>Main value</MenuItem>
                                        {subStatDefinitions.map(item => (
                                            <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                                        ))}
                                        {supportsFocusTime && <MenuItem value="focusTime">Focus time</MenuItem>}
                                    </Select>
                                </FormControl>
                            )}
                            {supportsComparison && (
                                <FormControl
                                    size="small"
                                    sx={{
                                        flex: '1 1 220px',
                                        minWidth: 0,
                                        '@container (min-width: 900px)': { minWidth: 220 },
                                    }}
                                    disabled={availableComparisons.length === 0 || focusTimeView}
                                >
                                    <InputLabel id="stat-overlay-label">Overlay stat</InputLabel>
                                    <Select
                                        labelId="stat-overlay-label"
                                        value={comparisonId}
                                        label="Overlay stat"
                                        onChange={event => setComparisonId(event.target.value)}
                                        inputProps={{ 'aria-label': `Overlay another stat on ${displayDefinition.name}` }}
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
                </Box>
                <StatViewTransition
                    viewKey={focusTimeView ? 'focus-time' : `${displayDefinition.id}:${isBooleanCalendar ? 'calendar' : 'chart'}`}
                >
                    {focusTimeView ? (
                        <TaskFocusTimeChart
                            definition={definition}
                            dateRange={dateRange}
                            periodMode={periodMode}
                            periodOffset={periodOffset}
                            refreshKey={refreshKey}
                        />
                    ) : isBooleanCalendar ? (
                        <BooleanCalendarView
                            definition={displayDefinition}
                            subStatDefinitions={displayDefinition.id === definition.id ? subStatDefinitions : []}
                            dateRange={dateRange}
                            periodMode={periodMode}
                            periodOffset={periodOffset}
                            refreshKey={refreshKey}
                            onEntryChanged={onEntryChanged}
                            onError={onError}
                            onDateContextMenu={onDateContextMenu}
                        />
                    ) : (
                        <StatLineChart
                            definition={displayDefinition}
                            subStatDefinitions={displayDefinition.id === definition.id ? subStatDefinitions : []}
                            comparisonDefinition={comparisonDefinition}
                            dateRange={dateRange}
                            periodMode={periodMode}
                            periodOffset={periodOffset}
                            refreshKey={refreshKey}
                            onEntryChanged={onEntryChanged}
                            onError={onError}
                            onDateContextMenu={onDateContextMenu}
                        />
                    )}
                </StatViewTransition>
            </CardContent>
            <StatInsightsDialog
                open={insightsOpen}
                onClose={() => setInsightsOpen(false)}
                definition={displayDefinition}
            />
        </Card>
    );
});
