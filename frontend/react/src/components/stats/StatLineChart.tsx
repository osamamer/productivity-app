import React, { useRef, useState, useEffect } from 'react';
import {
    AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, type MouseHandlerDataParam,
} from 'recharts';
import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { StatDefinition, StatEntry } from '../../types/Stats';
import { statService } from '../../services/api/statService';

interface ChartPoint {
    date: string;
    value: number | undefined;
    comparisonValue: number | undefined;
    hoverTarget: number;
    periodEnd?: string;
}

interface Props {
    definition: StatDefinition;
    comparisonDefinition?: StatDefinition;
    dateRange: number;
    refreshKey: number;
    onEntryChanged?: () => void;
}

function valueForDate(
    entriesByDate: Map<string, number>,
    date: string,
    definition?: StatDefinition,
): number | undefined {
    return entriesByDate.get(date) ?? (definition?.type === 'BOOLEAN' ? 0 : undefined);
}

function buildChartPoints(
    from: Date,
    to: Date,
    entries: StatEntry[],
    definition: StatDefinition,
    comparisonEntries: StatEntry[],
    comparisonDefinition?: StatDefinition,
): ChartPoint[] {
    const entryMap = new Map(entries.map(entry => [entry.date, entry.value]));
    const comparisonEntryMap = new Map(comparisonEntries.map(entry => [entry.date, entry.value]));
    return eachDayOfInterval({ start: from, end: to }).map(day => {
        const date = format(day, 'yyyy-MM-dd');
        return {
            date,
            value: valueForDate(entryMap, date, definition),
            comparisonValue: valueForDate(comparisonEntryMap, date, comparisonDefinition),
            hoverTarget: 0,
        };
    });
}

function average(values: number[]): number | undefined {
    return values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : undefined;
}

function buildWeeklyChartPoints(
    from: Date,
    to: Date,
    entries: StatEntry[],
    definition: StatDefinition,
    comparisonEntries: StatEntry[],
    comparisonDefinition?: StatDefinition,
): ChartPoint[] {
    const days = eachDayOfInterval({ start: from, end: to });
    const entriesByDate = new Map(entries.map(entry => [entry.date, entry.value]));
    const comparisonEntriesByDate = new Map(comparisonEntries.map(entry => [entry.date, entry.value]));
    const points: ChartPoint[] = [];

    for (let index = 0; index < days.length; index += 7) {
        const week = days.slice(index, index + 7);
        const values = week
            .map(day => valueForDate(entriesByDate, format(day, 'yyyy-MM-dd'), definition))
            .filter((value): value is number => value !== undefined);
        const comparisonValues = week
            .map(day => valueForDate(
                comparisonEntriesByDate,
                format(day, 'yyyy-MM-dd'),
                comparisonDefinition,
            ))
            .filter((value): value is number => value !== undefined);

        points.push({
            date: format(week[0], 'yyyy-MM-dd'),
            periodEnd: format(week[week.length - 1], 'yyyy-MM-dd'),
            value: average(values),
            comparisonValue: average(comparisonValues),
            hoverTarget: 0,
        });
    }

    return points;
}

function formatChartValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPointValue(value: number | undefined, definition: StatDefinition, averaged: boolean): string {
    if (value === undefined) return 'No data';
    if (definition.type === 'BOOLEAN') return averaged ? `${Math.round(value * 100)}% yes` : value === 1 ? 'Yes' : 'No';
    return averaged ? `Average ${formatChartValue(value)}` : formatChartValue(value);
}

function chartDomain(definition: StatDefinition): [number | string, number | string] {
    if (definition.type === 'BOOLEAN') return [0, 1];
    if (definition.type === 'RANGE') return [0, definition.maxValue!];
    return [0, 'auto'];
}

function formatAxisValue(value: number, definition: StatDefinition): string {
    if (definition.type !== 'BOOLEAN') return formatChartValue(value);
    if (value === 0) return 'No';
    if (value === 1) return 'Yes';
    return '';
}

export function StatLineChart({
    definition,
    comparisonDefinition,
    dateRange,
    refreshKey,
    onEntryChanged,
}: Props) {
    const theme = useTheme();
    const to = new Date();
    const from = subDays(to, dateRange - 1);
    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(to, 'yyyy-MM-dd');
    const isYearView = dateRange >= 365;
    const comparisonId = comparisonDefinition?.id;
    const createChartPoints = (entries: StatEntry[], comparisonEntries: StatEntry[]) => isYearView
        ? buildWeeklyChartPoints(
            from,
            to,
            entries,
            definition,
            comparisonEntries,
            comparisonDefinition,
        )
        : buildChartPoints(from, to, entries, definition, comparisonEntries, comparisonDefinition);
    const dataKey = `${definition.id}:${comparisonId ?? 'none'}:${fromStr}:${toStr}`;
    const cachedEntries = statService.getCachedEntries(definition.id, fromStr, toStr);
    const cachedComparisonEntries = comparisonId
        ? statService.getCachedEntries(comparisonId, fromStr, toStr)
        : [];
    const hasCachedData = Boolean(cachedEntries && cachedComparisonEntries);
    const [dataState, setDataState] = useState<{ key: string; points: ChartPoint[] }>(() => ({
        key: dataKey,
        points: createChartPoints(cachedEntries ?? [], cachedComparisonEntries ?? []),
    }));
    const [loadingKey, setLoadingKey] = useState<string | null>(hasCachedData ? null : dataKey);
    const data = dataState.key === dataKey
        ? dataState.points
        : createChartPoints(cachedEntries ?? [], cachedComparisonEntries ?? []);
    const loading = loadingKey === dataKey || (dataState.key !== dataKey && !hasCachedData);
    const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
    const [editorPosition, setEditorPosition] = useState<{ left: number; top: number } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveRef = useRef<{ date: string; value: string } | null>(null);
    const chartHoveredRef = useRef(false);
    const editorHoveredRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        const primaryEntries = statService.getCachedEntries(definition.id, fromStr, toStr);
        const comparisonEntries = comparisonId
            ? statService.getCachedEntries(comparisonId, fromStr, toStr)
            : [];
        if (!primaryEntries || !comparisonEntries) setLoadingKey(dataKey);
        setHoveredPoint(null);
        setEditorPosition(null);
        Promise.all([
            statService.getEntries(definition.id, fromStr, toStr),
            comparisonId ? statService.getEntries(comparisonId, fromStr, toStr) : Promise.resolve([]),
        ])
            .then(([entries, nextComparisonEntries]) => {
                if (!cancelled) {
                    setDataState({
                        key: dataKey,
                        points: isYearView
                            ? buildWeeklyChartPoints(
                                parseISO(fromStr),
                                parseISO(toStr),
                                entries,
                                definition,
                                nextComparisonEntries,
                                comparisonDefinition,
                            )
                            : buildChartPoints(
                                parseISO(fromStr),
                                parseISO(toStr),
                                entries,
                                definition,
                                nextComparisonEntries,
                                comparisonDefinition,
                            ),
                    });
                }
            })
            .catch(e => console.error('Failed to fetch stat entries for chart comparison:', e))
            .finally(() => {
                if (!cancelled) setLoadingKey(current => current === dataKey ? null : current);
            });
        return () => { cancelled = true; };
    }, [comparisonDefinition, comparisonId, dataKey, definition, fromStr, isYearView, refreshKey, toStr]);

    useEffect(() => {
        setEditValue(hoveredPoint?.value === undefined ? '' : String(hoveredPoint.value));
        setSaveError(null);
    }, [hoveredPoint?.date, hoveredPoint?.value]);

    useEffect(() => () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    const yDomain = chartDomain(definition);
    const comparisonYDomain = comparisonDefinition ? chartDomain(comparisonDefinition) : undefined;

    const tickFormat = isYearView
        ? (d: string) => format(parseISO(d), 'MMM')
        : dateRange <= 7
        ? (d: string) => format(parseISO(d), 'EEE')
        : (d: string) => format(parseISO(d), 'MMM d');

    const gradientId = `gradient-${definition.id}`;
    const primaryColor = theme.palette.primary.main;
    const comparisonColor = theme.palette.secondary.main;

    const handleSaved = (date: string, value: number) => {
        setDataState(previous => previous.key === dataKey
            ? { ...previous, points: previous.points.map(point => point.date === date ? { ...point, value } : point) }
            : previous);
        setHoveredPoint(previous => previous?.date === date ? { ...previous, value } : previous);
    };

    const clearCloseTimer = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    const scheduleEditorClose = () => {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
            if (!chartHoveredRef.current && !editorHoveredRef.current) {
                setHoveredPoint(null);
                setEditorPosition(null);
            }
        }, 0);
    };

    const handleChartEnter = () => {
        chartHoveredRef.current = true;
        clearCloseTimer();
    };

    const handleChartLeave = () => {
        chartHoveredRef.current = false;
        scheduleEditorClose();
    };

    const handleEditorEnter = () => {
        editorHoveredRef.current = true;
        clearCloseTimer();
    };

    const handleEditorLeave = () => {
        editorHoveredRef.current = false;
        scheduleEditorClose();
    };

    const saveEntry = async (date: string, rawValue: string) => {
        if (rawValue.trim() === '') return;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) {
            setSaveError('Enter a number first.');
            return;
        }
        if (definition.type === 'RANGE'
            && (value < definition.minValue! || value > definition.maxValue!)) {
            setSaveError(`Use a value from ${definition.minValue} to ${definition.maxValue}.`);
            return;
        }

        setSaveError(null);
        try {
            await statService.recordEntry({
                statDefinitionId: definition.id,
                date,
                value,
            });
            handleSaved(date, value);
            onEntryChanged?.();
        } catch (error) {
            console.error('Failed to save chart stat entry:', error);
            setSaveError('Failed to save this value.');
        }
    };

    const queueEntrySave = (date: string, value: string) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        pendingSaveRef.current = value.trim() === '' ? null : { date, value };
        if (!pendingSaveRef.current) return;

        saveTimerRef.current = setTimeout(() => {
            const pendingSave = pendingSaveRef.current;
            pendingSaveRef.current = null;
            saveTimerRef.current = null;
            if (pendingSave) void saveEntry(pendingSave.date, pendingSave.value);
        }, 400);
    };

    const flushEntrySave = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const pendingSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (pendingSave) void saveEntry(pendingSave.date, pendingSave.value);
    };

    const handleChartMouseMove = (state: MouseHandlerDataParam) => {
        if (state.activeTooltipIndex === null || state.activeTooltipIndex === undefined) {
            setHoveredPoint(null);
            setEditorPosition(null);
            return;
        }
        const index = Number(state.activeTooltipIndex);
        if (!Number.isInteger(index) || index < 0 || index >= data.length) return;
        chartHoveredRef.current = true;
        clearCloseTimer();
        setHoveredPoint(data[index]);

        if (chartRef.current && state.activeCoordinate) {
            const editorWidth = 112;
            const editorHeight = 50;
            const maxLeft = Math.max(8, chartRef.current.clientWidth - editorWidth - 8);
            const maxTop = Math.max(8, chartRef.current.clientHeight - editorHeight - 8);
            setEditorPosition({
                left: Math.min(Math.max(8, state.activeCoordinate.x + 12), maxLeft),
                top: Math.min(Math.max(8, state.activeCoordinate.y + 12), maxTop),
            });
        }
    };

    return (
        <Box sx={{ position: 'relative' }}>
            {comparisonDefinition && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 18, borderTop: `3px solid ${primaryColor}`, borderRadius: 1 }} />
                        <Typography variant="caption" fontWeight={600}>{definition.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 18, borderTop: `3px solid ${comparisonColor}`, borderRadius: 1 }} />
                        <Typography variant="caption" fontWeight={600}>{comparisonDefinition.name}</Typography>
                    </Box>
                </Box>
            )}
            <Box
                ref={chartRef}
                onMouseEnter={handleChartEnter}
                onMouseLeave={handleChartLeave}
                sx={{ height: 200, opacity: loading ? 0.55 : 1, transition: 'opacity 120ms ease' }}
            >
                <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                    data={data}
                    margin={{ top: 5, right: comparisonDefinition ? 0 : 10, left: 0, bottom: 5 }}
                    onMouseMove={handleChartMouseMove}
                >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={comparisonDefinition ? 0.12 : 0.3} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                    dataKey="date"
                    tickFormatter={tickFormat}
                    minTickGap={isYearView ? 28 : 5}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                    axisLine={{ stroke: theme.palette.divider }}
                    tickLine={false}
                />
                <YAxis
                    yAxisId="primary"
                    domain={yDomain}
                    tickFormatter={value => formatAxisValue(value, definition)}
                    tick={{ fontSize: 11, fill: comparisonDefinition ? primaryColor : theme.palette.text.secondary }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                />
                {comparisonDefinition && (
                    <YAxis
                        yAxisId="comparison"
                        orientation="right"
                        domain={comparisonYDomain}
                        tickFormatter={value => formatAxisValue(value, comparisonDefinition)}
                        tick={{ fontSize: 11, fill: comparisonColor }}
                        axisLine={false}
                        tickLine={false}
                        width={35}
                    />
                )}
                <YAxis yAxisId="hover" hide domain={[0, 1]} />
                <Tooltip
                    content={() => null}
                    cursor={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                />
                {definition.type === 'RANGE' && (
                    <>
                        <ReferenceLine yAxisId="primary" y={definition.minValue} stroke={theme.palette.error.main} strokeDasharray="4 4" strokeOpacity={0.6} />
                        <ReferenceLine yAxisId="primary" y={definition.maxValue} stroke={theme.palette.success.main} strokeDasharray="4 4" strokeOpacity={0.6} />
                    </>
                )}
                <Area
                    yAxisId="primary"
                    type={definition.type === 'BOOLEAN' ? 'stepAfter' : 'monotone'}
                    dataKey="value"
                    stroke={primaryColor}
                    fill={`url(#${gradientId})`}
                    strokeWidth={2}
                    dot={isYearView ? false : { r: 3, fill: primaryColor }}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                />
                {comparisonDefinition && (
                    <Line
                        yAxisId="comparison"
                        type={comparisonDefinition.type === 'BOOLEAN' ? 'stepAfter' : 'monotone'}
                        dataKey="comparisonValue"
                        stroke={comparisonColor}
                        strokeWidth={2}
                        dot={isYearView ? false : { r: 3, fill: comparisonColor }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                    />
                )}
                <Line
                    type="linear"
                    dataKey="hoverTarget"
                    yAxisId="hover"
                    stroke="transparent"
                    strokeWidth={20}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                />
                </AreaChart>
                </ResponsiveContainer>
            </Box>

            {loading && (
                <CircularProgress
                    size={18}
                    sx={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'none' }}
                />
            )}

            {hoveredPoint && editorPosition && dataState.key === dataKey && !isYearView && definition.type !== 'BOOLEAN' && (
                <Box
                    onMouseEnter={handleEditorEnter}
                    onMouseLeave={handleEditorLeave}
                    onMouseDown={event => event.stopPropagation()}
                    sx={{
                        position: 'absolute',
                        left: editorPosition.left,
                        top: editorPosition.top,
                        zIndex: 2,
                        p: 0.5,
                        backgroundColor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        boxShadow: 2,
                    }}
                >
                    {comparisonDefinition && (
                        <Box sx={{ px: 0.5, pb: 0.5, minWidth: 150 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                {format(parseISO(hoveredPoint.date), 'MMM d, yyyy')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: comparisonColor }} display="block" noWrap>
                                {comparisonDefinition.name}: {formatPointValue(hoveredPoint.comparisonValue, comparisonDefinition, false)}
                            </Typography>
                        </Box>
                    )}
                    <TextField
                        size="small"
                        type="number"
                        value={editValue}
                        onChange={event => {
                            const value = event.target.value;
                            setEditValue(value);
                            setSaveError(null);
                            queueEntrySave(hoveredPoint.date, value);
                        }}
                        onBlur={flushEntrySave}
                        onKeyDown={event => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                        }}
                        inputProps={{
                            min: definition.type === 'RANGE' ? definition.minValue : undefined,
                            max: definition.type === 'RANGE' ? definition.maxValue : undefined,
                            'aria-label': `${definition.name} value for ${format(parseISO(hoveredPoint.date), 'MMMM d, yyyy')}`,
                        }}
                        placeholder="Value"
                        autoFocus
                        error={Boolean(saveError)}
                        title={saveError ?? undefined}
                        sx={{ width: 102 }}
                    />
                </Box>
            )}

            {hoveredPoint && editorPosition && dataState.key === dataKey && (isYearView || definition.type === 'BOOLEAN') && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: editorPosition.left,
                        top: editorPosition.top,
                        zIndex: 2,
                        px: 1,
                        py: 0.75,
                        backgroundColor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        boxShadow: 2,
                        pointerEvents: 'none',
                    }}
                >
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {isYearView ? (
                            <>
                                {format(parseISO(hoveredPoint.date), 'MMM d')}
                                {' – '}
                                {format(parseISO(hoveredPoint.periodEnd ?? hoveredPoint.date), 'MMM d')}
                            </>
                        ) : format(parseISO(hoveredPoint.date), 'MMM d, yyyy')}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: comparisonDefinition ? primaryColor : 'text.primary' }}>
                        {comparisonDefinition && `${definition.name}: `}
                        {formatPointValue(hoveredPoint.value, definition, isYearView)}
                    </Typography>
                    {comparisonDefinition && (
                        <Typography variant="body2" fontWeight={600} sx={{ color: comparisonColor }}>
                            {comparisonDefinition.name}: {formatPointValue(
                                hoveredPoint.comparisonValue,
                                comparisonDefinition,
                                isYearView,
                            )}
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
}
