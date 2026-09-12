import React, { useRef, useState, useEffect } from 'react';
import {
    AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, type MouseHandlerDataParam,
} from 'recharts';
import { Box, CircularProgress, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { StatDefinition, StatEntry, StatEntryStatus } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getBooleanChoiceColor, showStatFeedback } from '../../services/statFeedback';
import {
    durationValueToMinutes, formatDurationValue, formatTimeValue,
    minutesToDurationValue, minutesToTimeValue, timeValueToMinutes,
} from '../../services/utils/statValues';
import { DurationStatChart } from './DurationStatChart';
import { TimeStatChart } from './TimeStatChart';
import { StatChartPoint, StatChartPointClickEvent } from './statChartTypes';
import { AppTimeField } from '../input/AppPickerFields';
import { AppNumberField } from '../input/AppNumberField';
import { formatStatBucketRange, getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';

type ChartPoint = StatChartPoint;

interface Props {
    definition: StatDefinition;
    comparisonDefinition?: StatDefinition;
    dateRange: number;
    periodMode: StatPeriodMode;
    periodOffset: StatPeriodOffset;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

function valueForDate(
    entriesByDate: Map<string, number>,
    date: string,
    definition?: StatDefinition,
): number | undefined {
    return entriesByDate.get(date) ?? (definition?.type === 'BOOLEAN' ? 0 : undefined);
}

function recordedEntries(entries: StatEntry[]): StatEntry[] {
    return entries.filter(entry => entry.status !== 'NOT_PLANNED');
}

function statusByDate(entries: StatEntry[]): Map<string, StatEntryStatus> {
    return new Map(entries.map(entry => [entry.date, entry.status ?? 'RECORDED'] as [string, StatEntryStatus]));
}

function buildChartPoints(
    from: Date,
    to: Date,
    entries: StatEntry[],
    definition: StatDefinition,
    comparisonEntries: StatEntry[],
    comparisonDefinition?: StatDefinition,
): ChartPoint[] {
    const entryMap = new Map(recordedEntries(entries).map(entry => [entry.date, entry.value]));
    const comparisonEntryMap = new Map(recordedEntries(comparisonEntries).map(entry => [entry.date, entry.value]));
    const entryStatuses = statusByDate(entries);
    const comparisonStatuses = statusByDate(comparisonEntries);
    return eachDayOfInterval({ start: from, end: to }).map(day => {
        const date = format(day, 'yyyy-MM-dd');
        return {
            date,
            value: valueForDate(entryMap, date, definition),
            comparisonValue: valueForDate(comparisonEntryMap, date, comparisonDefinition),
            hoverTarget: 0,
            status: entryStatuses.get(date),
            comparisonStatus: comparisonStatuses.get(date),
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
    const entriesByDate = new Map(recordedEntries(entries).map(entry => [entry.date, entry.value]));
    const comparisonEntriesByDate = new Map(recordedEntries(comparisonEntries).map(entry => [entry.date, entry.value]));
    const entryStatuses = statusByDate(entries);
    const comparisonStatuses = statusByDate(comparisonEntries);
    const points: ChartPoint[] = [];

    for (let index = 0; index < days.length; index += 7) {
        const week = days.slice(index, index + 7);
        const values = week
            .filter(day => entryStatuses.get(format(day, 'yyyy-MM-dd')) !== 'NOT_PLANNED')
            .map(day => valueForDate(entriesByDate, format(day, 'yyyy-MM-dd'), definition))
            .filter((value): value is number => value !== undefined);
        const comparisonValues = week
            .filter(day => comparisonStatuses.get(format(day, 'yyyy-MM-dd')) !== 'NOT_PLANNED')
            .map(day => valueForDate(
                comparisonEntriesByDate,
                format(day, 'yyyy-MM-dd'),
                comparisonDefinition,
            ))
            .filter((value): value is number => value !== undefined);

        points.push({
            date: format(week[0], 'yyyy-MM-dd'),
            bucketLabel: formatStatBucketRange(week[0], week[week.length - 1]),
            periodEnd: format(week[week.length - 1], 'yyyy-MM-dd'),
            value: average(values),
            comparisonValue: average(comparisonValues),
            hoverTarget: 0,
            status: values.length === 0 && week.some(day => entryStatuses.get(format(day, 'yyyy-MM-dd')) === 'NOT_PLANNED')
                ? 'NOT_PLANNED'
                : undefined,
            comparisonStatus: comparisonValues.length === 0 && week.some(day => comparisonStatuses.get(format(day, 'yyyy-MM-dd')) === 'NOT_PLANNED')
                ? 'NOT_PLANNED'
                : undefined,
        });
    }

    return points;
}

function formatChartValue(value: number): string {
    return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

function formatPointValue(
    value: number | undefined,
    definition: StatDefinition,
    averaged: boolean,
    status?: StatEntryStatus,
): string {
    if (value === undefined) return 'No data';
    if (definition.type === 'BOOLEAN') {
        return status === 'NOT_PLANNED'
            ? 'Not planned'
            : averaged ? `${Math.round(value * 100)}% yes` : value === 1 ? 'Yes' : 'No';
    }
    if (definition.type === 'TIME') return formatTimeValue(value);
    if (definition.type === 'DURATION') {
        return averaged ? `Average ${formatDurationValue(value)}` : formatDurationValue(value);
    }
    return averaged ? `Average ${formatChartValue(value)}` : formatChartValue(value);
}

type NumericDomain = [number, number];

function paddedDomain(minimum: number, maximum: number): NumericDomain {
    const span = maximum - minimum;
    const padding = span === 0
        ? Math.max(Math.abs(maximum) * 0.1, 1)
        : span * 0.1;
    return [minimum - padding, maximum + padding];
}

function chartDomain(definition: StatDefinition, values: Array<number | undefined>): NumericDomain {
    if (definition.type === 'BOOLEAN') return [0, 1];
    if (definition.type === 'TIME') return [0, 24 * 60];

    const finiteValues = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
    if (definition.type === 'RANGE') {
        finiteValues.push(definition.minValue!, definition.maxValue!);
    }
    if (definition.goodThreshold != null && definition.morality && definition.morality !== 'NEUTRAL') {
        finiteValues.push(definition.goodThreshold);
    }

    if (finiteValues.length === 0) return [0, 1];

    const minimum = Math.min(...finiteValues);
    const maximum = Math.max(...finiteValues);
    if (minimum >= 0) {
        if (maximum === 0) return [0, 1];
        const paddedMaximum = maximum * 1.1;
        const step = niceTickStep(paddedMaximum);
        const nextNiceTick = Math.ceil(maximum / step) * step;
        return [0, Math.max(paddedMaximum, nextNiceTick + step * 0.1)];
    }
    if (maximum <= 0) {
        const paddedMinimum = minimum * 1.1;
        const step = niceTickStep(Math.abs(paddedMinimum));
        const nextNiceTick = Math.floor(minimum / step) * step;
        return [Math.min(paddedMinimum, nextNiceTick - step * 0.1), 0];
    }
    return paddedDomain(minimum, maximum);
}

function niceTickStep(range: number, targetTickCount = 5): number {
    const rawStep = range / targetTickCount;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalizedStep = rawStep / magnitude;
    const multiplier = normalizedStep < Math.sqrt(2)
        ? 1
        : normalizedStep < Math.sqrt(10)
        ? 2
        : normalizedStep < Math.sqrt(50)
        ? 5
        : 10;
    return multiplier * magnitude;
}

function roundTick(value: number, step: number): number {
    const decimalPlaces = Math.max(0, Math.ceil(-Math.log10(step)) + 2);
    return Number(value.toFixed(decimalPlaces));
}

function axisTicks(definition: StatDefinition, domain: NumericDomain): number[] {
    if (definition.type === 'BOOLEAN') return [0, 1];
    if (definition.type === 'TIME') return [0, 6 * 60, 12 * 60, 18 * 60, 24 * 60];

    const [minimum, maximum] = domain;
    const step = niceTickStep(maximum - minimum);
    const firstIndex = Math.ceil(minimum / step - 1e-9);
    const lastIndex = Math.floor(maximum / step + 1e-9);
    const ticks = Array.from(
        { length: Math.max(0, lastIndex - firstIndex + 1) },
        (_, index) => roundTick((firstIndex + index) * step, step),
    );

    return [...new Set(ticks)].sort((left, right) => left - right);
}

function formatAxisValue(value: number, definition: StatDefinition): string {
    if (definition.type === 'TIME') return formatTimeValue(value);
    if (definition.type === 'DURATION') return formatDurationValue(value);
    if (definition.type !== 'BOOLEAN') return formatChartValue(value);
    if (value === 0) return 'No';
    if (value === 1) return 'Yes';
    return '';
}

export const StatLineChart = React.memo(function StatLineChart({
    definition,
    comparisonDefinition,
    dateRange,
    periodMode,
    periodOffset,
    refreshKey,
    onEntryChanged,
    onDateContextMenu,
}: Props) {
    const theme = useTheme();
    const period = getStatPeriodWindow(dateRange, periodMode, periodOffset);
    const fromStr = period.from;
    const toStr = period.to;
    const from = parseISO(fromStr);
    const to = parseISO(toStr);
    const isYearView = dateRange >= 365;
    const aggregateWeekly = isYearView && definition.type !== 'TIME';
    const comparisonId = comparisonDefinition?.id;
    const createChartPoints = (entries: StatEntry[], comparisonEntries: StatEntry[]) => aggregateWeekly
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
    const hasRenderedDataRef = useRef(hasCachedData);
    const [loadingKey, setLoadingKey] = useState<string | null>(hasCachedData ? null : dataKey);
    const cachedPoints = cachedEntries && cachedComparisonEntries
        ? createChartPoints(cachedEntries, cachedComparisonEntries)
        : null;
    // Keep the last plotted points in place while a new timeframe or overlay
    // loads. The chart can fade slightly, but its box never collapses or flashes.
    const data = dataState.key === dataKey
        ? dataState.points
        : cachedPoints ?? dataState.points;
    const loading = loadingKey === dataKey
        || (dataState.key !== dataKey && !hasCachedData && !hasRenderedDataRef.current);
    const [animateChart, setAnimateChart] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
    const [hoveredThreshold, setHoveredThreshold] = useState<'primary' | 'comparison' | null>(null);
    const [editorPosition, setEditorPosition] = useState<{ left: number; top: number } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editStatus, setEditStatus] = useState<StatEntryStatus>('RECORDED');
    const [saveError, setSaveError] = useState<string | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveRef = useRef<{ date: string; value: string; status: StatEntryStatus } | null>(null);
    const chartHoveredRef = useRef(false);
    const editorHoveredRef = useRef(false);

    useEffect(() => {
        if (!loading) setAnimateChart(false);
    }, [loading]);

    useEffect(() => {
        let cancelled = false;
        const primaryEntries = statService.getCachedEntries(definition.id, fromStr, toStr);
        const comparisonEntries = comparisonId
            ? statService.getCachedEntries(comparisonId, fromStr, toStr)
            : [];
        if ((!primaryEntries || !comparisonEntries) && !hasRenderedDataRef.current) {
            setLoadingKey(dataKey);
        }
        setHoveredPoint(null);
        setHoveredThreshold(null);
        setEditorPosition(null);
        Promise.all([
            statService.getEntries(definition.id, fromStr, toStr),
            comparisonId ? statService.getEntries(comparisonId, fromStr, toStr) : Promise.resolve([]),
        ])
            .then(([entries, nextComparisonEntries]) => {
                if (!cancelled) {
                    setDataState({
                        key: dataKey,
                        points: aggregateWeekly
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
                    hasRenderedDataRef.current = true;
                }
            })
            .catch(e => console.error('Failed to fetch stat entries for chart comparison:', e))
            .finally(() => {
                if (!cancelled) setLoadingKey(current => current === dataKey ? null : current);
            });
        return () => { cancelled = true; };
    }, [aggregateWeekly, comparisonDefinition, comparisonId, dataKey, definition, fromStr, refreshKey, toStr]);

    useEffect(() => {
        setEditValue(hoveredPoint?.value === undefined
            ? ''
            : definition.type === 'TIME'
                ? minutesToTimeValue(hoveredPoint.value)
                : definition.type === 'DURATION'
                    ? minutesToDurationValue(hoveredPoint.value)
                : String(hoveredPoint.value));
        setEditStatus(hoveredPoint?.status ?? 'RECORDED');
        setSaveError(null);
    }, [definition.type, hoveredPoint?.date, hoveredPoint?.status, hoveredPoint?.value]);

    useEffect(() => () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    const yDomain = chartDomain(definition, data.map(point => point.value));
    const yTicks = axisTicks(definition, yDomain);
    const comparisonYDomain = comparisonDefinition
        ? chartDomain(comparisonDefinition, data.map(point => point.comparisonValue))
        : undefined;
    const comparisonYTicks = comparisonDefinition && comparisonYDomain
        ? axisTicks(comparisonDefinition, comparisonYDomain)
        : undefined;

    const tickFormat = isYearView
        ? (d: string) => format(parseISO(d), 'MMM')
        : dateRange <= 7
        ? (d: string) => format(parseISO(d), 'EEE')
        : (d: string) => format(parseISO(d), 'MMM d');

    const gradientId = `gradient-${definition.id}`;
    const primaryColor = theme.palette.primary.main;
    const comparisonColor = theme.palette.secondary.main;

    const handleSaved = (date: string, value: number | null, status: StatEntryStatus = 'RECORDED') => {
        const nextValue = value ?? undefined;
        setDataState(previous => previous.key === dataKey
            ? { ...previous, points: previous.points.map(point => point.date === date ? { ...point, value: nextValue, status } : point) }
            : previous);
        setHoveredPoint(previous => previous?.date === date ? { ...previous, value: nextValue, status } : previous);
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
        setHoveredThreshold(null);
        scheduleEditorClose();
    };

    const handleThresholdEnter = (axis: 'primary' | 'comparison') => {
        setHoveredThreshold(axis);
        setHoveredPoint(null);
        setEditorPosition(null);
    };

    const handleEditorEnter = () => {
        editorHoveredRef.current = true;
        clearCloseTimer();
    };

    const handleEditorLeave = () => {
        editorHoveredRef.current = false;
        scheduleEditorClose();
    };

    const saveEntry = async (date: string, rawValue: string, status: StatEntryStatus = 'RECORDED') => {
        const value = definition.type === 'TIME'
            ? rawValue.trim() === '' ? null : timeValueToMinutes(rawValue)
            : definition.type === 'DURATION'
                ? rawValue.trim() === '' ? null : durationValueToMinutes(rawValue)
                : rawValue.trim() === '' ? null : Number(rawValue);
        if (status === 'NOT_PLANNED') {
            setSaveError(null);
            try {
                await statService.recordEntry({
                    statDefinitionId: definition.id,
                    date,
                    value: null,
                    status,
                });
                handleSaved(date, 0, status);
                onEntryChanged?.(definition.id);
            } catch (error) {
                console.error('Failed to mark chart stat entry as not planned:', error);
                setSaveError('Failed to save this value.');
            }
            return;
        }
        if (value === null) {
            setSaveError(null);
            try {
                await statService.recordEntry({
                    statDefinitionId: definition.id,
                    date,
                    value: null,
                });
                handleSaved(date, null, 'RECORDED');
                onEntryChanged?.(definition.id);
            } catch (error) {
                console.error('Failed to clear chart stat entry:', error);
                setSaveError('Failed to clear this value.');
            }
            return;
        }
        if (!Number.isFinite(value)) {
            setSaveError(definition.type === 'TIME'
                ? 'Choose a valid time.'
                : definition.type === 'DURATION'
                    ? 'Enter a duration as hours:minutes.'
                    : 'Enter a number first.');
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
                status,
            });
            showStatFeedback(definition, value, chartRef.current);
            handleSaved(date, value, status);
            onEntryChanged?.(definition.id);
        } catch (error) {
            console.error('Failed to save chart stat entry:', error);
            setSaveError('Failed to save this value.');
        }
    };

    const queueEntrySave = (date: string, value: string, status: StatEntryStatus = 'RECORDED') => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        pendingSaveRef.current = { date, value, status };

        saveTimerRef.current = setTimeout(() => {
            const pendingSave = pendingSaveRef.current;
            pendingSaveRef.current = null;
            saveTimerRef.current = null;
            if (pendingSave) void saveEntry(pendingSave.date, pendingSave.value, pendingSave.status);
        }, 400);
    };

    const flushEntrySave = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const pendingSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (pendingSave) void saveEntry(pendingSave.date, pendingSave.value, pendingSave.status);
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

    const openSpecialEditor = (point: ChartPoint, event: StatChartPointClickEvent) => {
        if (point.value === undefined || !chartRef.current) return;
        chartHoveredRef.current = true;
        clearCloseTimer();
        setHoveredPoint(point);
        const bounds = chartRef.current.getBoundingClientRect();
        const editorWidth = 112;
        const editorHeight = 50;
        setEditorPosition({
            left: Math.min(Math.max(8, event.clientX - bounds.left + 10), Math.max(8, bounds.width - editorWidth - 8)),
            top: Math.min(Math.max(8, event.clientY - bounds.top + 10), Math.max(8, bounds.height - editorHeight - 8)),
        });
    };

    const comparisonHasSameType = !comparisonDefinition || comparisonDefinition.type === definition.type;
    const specialChart = definition.type === 'TIME' && comparisonHasSameType
        ? (
            <TimeStatChart
                definition={definition}
                comparisonDefinition={comparisonDefinition}
                points={data}
                dateRange={dateRange}
                theme={theme}
                onPointClick={openSpecialEditor}
                onDateContextMenu={onDateContextMenu}
            />
        )
        : definition.type === 'DURATION' && comparisonHasSameType
            ? (
                <DurationStatChart
                    definition={definition}
                    comparisonDefinition={comparisonDefinition}
                    points={data}
                    dateRange={dateRange}
                    theme={theme}
                    onPointClick={openSpecialEditor}
                    onDateContextMenu={onDateContextMenu}
                />
            )
            : null;

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
                onContextMenu={event => {
                    if (!onDateContextMenu || !hoveredPoint || hoveredPoint.periodEnd) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onDateContextMenu(hoveredPoint.date, event);
                }}
                sx={{ minHeight: definition.type === 'TIME' && dateRange <= 7 ? 220 : 200, opacity: loading ? 0.55 : 1, transition: 'opacity 120ms ease', pb: definition.type === 'DURATION' ? 3 : 0 }}
            >
                {specialChart ?? <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                    data={data}
                    margin={{ top: 12, right: comparisonDefinition ? 48 : 12, left: 48, bottom: 5 }}
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
                    padding={{ left: 6, right: 6 }}
                    minTickGap={isYearView ? 28 : 5}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                    axisLine={{ stroke: theme.palette.divider }}
                    tickLine={false}
                />
                <YAxis
                    yAxisId="primary"
                    domain={yDomain}
                    ticks={yTicks}
                    tickFormatter={value => formatAxisValue(value, definition)}
                    tick={{ fontSize: 11, fill: comparisonDefinition ? primaryColor : theme.palette.text.secondary }}
                    axisLine={{ stroke: theme.palette.divider }}
                    tickLine={{ stroke: theme.palette.divider }}
                    tickMargin={4}
                    interval={0}
                    width={52}
                />
                {comparisonDefinition && (
                    <YAxis
                        yAxisId="comparison"
                        orientation="right"
                        domain={comparisonYDomain}
                        ticks={comparisonYTicks}
                        tickFormatter={value => formatAxisValue(value, comparisonDefinition)}
                        tick={{ fontSize: 11, fill: comparisonColor }}
                        axisLine={{ stroke: theme.palette.divider }}
                        tickLine={{ stroke: theme.palette.divider }}
                        tickMargin={4}
                        interval={0}
                        width={52}
                    />
                )}
                <YAxis yAxisId="hover" hide domain={[0, 1]} />
                <Tooltip
                    active={hoveredThreshold === null}
                    content={() => null}
                    cursor={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                />
                {definition.type === 'RANGE' && (
                    <>
                        <ReferenceLine yAxisId="primary" y={definition.minValue} stroke={theme.palette.error.main} strokeDasharray="4 4" strokeOpacity={0.6} />
                        <ReferenceLine yAxisId="primary" y={definition.maxValue} stroke={theme.palette.success.main} strokeDasharray="4 4" strokeOpacity={0.6} />
                    </>
                )}
                {definition.goodThreshold != null && definition.morality && definition.morality !== 'NEUTRAL' && (
                    <ReferenceLine
                        yAxisId="primary"
                        y={definition.goodThreshold}
                        stroke={theme.palette.success.main}
                        strokeDasharray="6 3"
                        strokeOpacity={0.8}
                        strokeWidth={2}
                        zIndex={1300}
                        pointerEvents="stroke"
                        onMouseEnter={() => handleThresholdEnter('primary')}
                        onMouseLeave={() => setHoveredThreshold(null)}
                        label={{
                            value: formatAxisValue(definition.goodThreshold, definition),
                            position: 'insideBottomRight',
                            fill: theme.palette.success.main,
                            fontSize: 11,
                        }}
                    />
                )}
                {comparisonDefinition?.goodThreshold != null
                    && comparisonDefinition.morality
                    && comparisonDefinition.morality !== 'NEUTRAL' && (
                    <ReferenceLine
                        yAxisId="comparison"
                        y={comparisonDefinition.goodThreshold}
                        stroke={theme.palette.success.main}
                        strokeDasharray="6 3"
                        strokeOpacity={0.8}
                        strokeWidth={2}
                        zIndex={1300}
                        pointerEvents="stroke"
                        onMouseEnter={() => handleThresholdEnter('comparison')}
                        onMouseLeave={() => setHoveredThreshold(null)}
                        label={{
                            value: formatAxisValue(comparisonDefinition.goodThreshold, comparisonDefinition),
                            position: 'insideBottomLeft',
                            fill: theme.palette.success.main,
                            fontSize: 11,
                        }}
                    />
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
                    isAnimationActive={animateChart && !loading}
                    animationDuration={320}
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
                    isAnimationActive={animateChart && !loading}
                    animationDuration={320}
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
                </ResponsiveContainer>}
            </Box>

            {loading && (
                <CircularProgress
                    size={18}
                    sx={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'none' }}
                />
            )}

            {hoveredThreshold === null && hoveredPoint && editorPosition && dataState.key === dataKey && !isYearView && (
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
                                {comparisonDefinition.name}: {formatPointValue(
                                    hoveredPoint.comparisonValue,
                                    comparisonDefinition,
                                    false,
                                    hoveredPoint.comparisonStatus,
                                )}
                            </Typography>
                        </Box>
                    )}
                    {definition.type === 'BOOLEAN' ? (
                        <ToggleButtonGroup
                            value={editStatus === 'NOT_PLANNED'
                                ? 'not-planned'
                                : editValue === '1' ? 'yes' : editValue === '0' ? 'no' : null}
                            exclusive
                            onChange={(_, value) => {
                                const nextStatus: StatEntryStatus = value === 'not-planned' ? 'NOT_PLANNED' : 'RECORDED';
                                const nextValue = value === null ? '' : value === 'yes' ? '1' : value === 'no' ? '0' : '';
                                setEditStatus(nextStatus);
                                setEditValue(nextValue);
                                queueEntrySave(hoveredPoint.date, nextValue, nextStatus);
                            }}
                            size="small"
                        >
                            <ToggleButton
                                value="yes"
                                sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 1)}.dark` } } }}
                                        >
                                            Yes
                                        </ToggleButton>
                                        <ToggleButton
                                            value="not-planned"
                                            sx={{ '&.Mui-selected': { bgcolor: 'notPlanned.main', color: 'notPlanned.contrastText', '&:hover': { bgcolor: 'notPlanned.dark' } } }}
                                        >
                                            Not planned
                                        </ToggleButton>
                                        <ToggleButton
                                            value="no"
                                sx={{ '&.Mui-selected': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.main`, color: 'white', '&:hover': { bgcolor: `${getBooleanChoiceColor(definition, 0)}.dark` } } }}
                                        >
                                            No
                                        </ToggleButton>
                        </ToggleButtonGroup>
                    ) : definition.type === 'TIME' ? (
                        <AppTimeField
                            label="Time"
                            value={editValue}
                            onChange={value => {
                                setEditValue(value);
                                setSaveError(null);
                                queueEntrySave(hoveredPoint.date, value);
                            }}
                            onBlur={flushEntrySave}
                            inputProps={{
                                'aria-label': `${definition.name} value for ${format(parseISO(hoveredPoint.date), 'MMMM d, yyyy')}`,
                            }}
                            autoFocus
                            error={Boolean(saveError)}
                            sx={{ width: 140 }}
                        />
                    ) : definition.type === 'DURATION' ? (
                        <TextField
                            size="small"
                            autoComplete="off"
                            type="text"
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
                                min: 0,
                                'aria-label': `${definition.name} value for ${format(parseISO(hoveredPoint.date), 'MMMM d, yyyy')}`,
                            }}
                            placeholder="H:MM"
                            autoFocus
                            error={Boolean(saveError)}
                            title={saveError ?? undefined}
                            sx={{ width: 102 }}
                        />
                    ) : (
                        <AppNumberField
                            size="small"
                            autoComplete="off"
                            value={editValue}
                            onChange={event => {
                                const value = event.target.value;
                                setEditValue(value);
                                setSaveError(null);
                                queueEntrySave(hoveredPoint.date, value);
                            }}
                            onStepValueChange={value => {
                                const nextValue = String(value);
                                setEditValue(nextValue);
                                setSaveError(null);
                                queueEntrySave(hoveredPoint.date, nextValue);
                            }}
                            onBlur={flushEntrySave}
                            onKeyDown={event => {
                                if (event.key === 'Enter') event.currentTarget.blur();
                            }}
                            min={definition.type === 'RANGE' ? definition.minValue : undefined}
                            max={definition.type === 'RANGE' ? definition.maxValue : undefined}
                            inputProps={{
                                'aria-label': `${definition.name} value for ${format(parseISO(hoveredPoint.date), 'MMMM d, yyyy')}`,
                            }}
                            placeholder="Value"
                            autoFocus
                            error={Boolean(saveError)}
                            title={saveError ?? undefined}
                            sx={{ width: 102 }}
                        />
                    )}
                </Box>
            )}

            {hoveredThreshold === null && hoveredPoint && editorPosition && dataState.key === dataKey && isYearView && (
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
                        {isYearView
                            ? hoveredPoint.bucketLabel
                            : format(parseISO(hoveredPoint.date), 'MMM d, yyyy')}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: comparisonDefinition ? primaryColor : 'text.primary' }}>
                        {comparisonDefinition && `${definition.name}: `}
                        {formatPointValue(hoveredPoint.value, definition, isYearView, hoveredPoint.status)}
                    </Typography>
                    {comparisonDefinition && (
                        <Typography variant="body2" fontWeight={600} sx={{ color: comparisonColor }}>
                            {comparisonDefinition.name}: {formatPointValue(
                                hoveredPoint.comparisonValue,
                                comparisonDefinition,
                                isYearView,
                                hoveredPoint.comparisonStatus,
                            )}
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
});
