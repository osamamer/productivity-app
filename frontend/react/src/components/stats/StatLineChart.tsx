import React, { useRef, useState, useEffect } from 'react';
import {
    AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, type MouseHandlerDataParam,
} from 'recharts';
import { Box, CircularProgress, TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { StatDefinition, StatEntry } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { celebrateStatLogged } from '../../services/statCelebration';

interface ChartPoint {
    date: string;
    value: number | undefined;
    hoverTarget: number;
}

interface Props {
    definition: StatDefinition;
    dateRange: number;
    refreshKey: number;
    onEntryChanged?: () => void;
}

function buildChartPoints(from: Date, to: Date, entries: StatEntry[]): ChartPoint[] {
    const entryMap = new Map(entries.map(entry => [entry.date, entry.value]));
    return eachDayOfInterval({ start: from, end: to }).map(day => {
        const date = format(day, 'yyyy-MM-dd');
        return { date, value: entryMap.get(date), hoverTarget: 0 };
    });
}

export function StatLineChart({ definition, dateRange, refreshKey, onEntryChanged }: Props) {
    const theme = useTheme();
    const to = new Date();
    const from = subDays(to, dateRange - 1);
    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(to, 'yyyy-MM-dd');
    const dataKey = `${definition.id}:${fromStr}:${toStr}`;
    const cachedEntries = statService.getCachedEntries(definition.id, fromStr, toStr);
    const [dataState, setDataState] = useState<{ key: string; points: ChartPoint[] }>(() => ({
        key: dataKey,
        points: buildChartPoints(from, to, cachedEntries ?? []),
    }));
    const [loadingKey, setLoadingKey] = useState<string | null>(cachedEntries ? null : dataKey);
    const data = dataState.key === dataKey
        ? dataState.points
        : buildChartPoints(from, to, cachedEntries ?? []);
    const loading = loadingKey === dataKey || (dataState.key !== dataKey && !cachedEntries);
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
        if (!statService.getCachedEntries(definition.id, fromStr, toStr)) setLoadingKey(dataKey);
        setHoveredPoint(null);
        setEditorPosition(null);
        statService.getEntries(definition.id, fromStr, toStr)
            .then(entries => {
                if (!cancelled) {
                    setDataState({
                        key: dataKey,
                        points: buildChartPoints(parseISO(fromStr), parseISO(toStr), entries),
                    });
                }
            })
            .catch(e => console.error('Failed to fetch stat entries for chart:', e))
            .finally(() => {
                if (!cancelled) setLoadingKey(current => current === dataKey ? null : current);
            });
        return () => { cancelled = true; };
    }, [dataKey, definition.id, fromStr, refreshKey, toStr]);

    useEffect(() => {
        setEditValue(hoveredPoint?.value === undefined ? '' : String(hoveredPoint.value));
        setSaveError(null);
    }, [hoveredPoint?.date, hoveredPoint?.value]);

    useEffect(() => () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    const yDomain: [number | string, number | string] = definition.type === 'RANGE'
        ? [definition.minValue!, definition.maxValue!]
        : ['auto', 'auto'];

    const tickFormat = dateRange <= 7
        ? (d: string) => format(parseISO(d), 'EEE')
        : (d: string) => format(parseISO(d), 'MMM d');

    const gradientId = `gradient-${definition.id}`;

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
            celebrateStatLogged();
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
            <Box
                ref={chartRef}
                onMouseEnter={handleChartEnter}
                onMouseLeave={handleChartLeave}
                sx={{ height: 200, opacity: loading ? 0.55 : 1, transition: 'opacity 120ms ease' }}
            >
                <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                    data={data}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    onMouseMove={handleChartMouseMove}
                >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                    dataKey="date"
                    tickFormatter={tickFormat}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                    axisLine={{ stroke: theme.palette.divider }}
                    tickLine={false}
                />
                <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                />
                <YAxis yAxisId="hover" hide domain={[0, 1]} />
                <Tooltip
                    content={() => null}
                    cursor={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                />
                {definition.type === 'RANGE' && (
                    <>
                        <ReferenceLine y={definition.minValue} stroke={theme.palette.error.main} strokeDasharray="4 4" strokeOpacity={0.6} />
                        <ReferenceLine y={definition.maxValue} stroke={theme.palette.success.main} strokeDasharray="4 4" strokeOpacity={0.6} />
                    </>
                )}
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={theme.palette.primary.main}
                    fill={`url(#${gradientId})`}
                    strokeWidth={2}
                    dot={{ r: 3, fill: theme.palette.primary.main }}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                />
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

            {hoveredPoint && editorPosition && dataState.key === dataKey && (
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
        </Box>
    );
}
