import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { StatDefinition, StatFocusTimeEntry } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { DurationStatChart } from './DurationStatChart';
import { StatChartPoint } from './statChartTypes';
import { formatStatBucketRange, getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';

interface Props {
    definition: StatDefinition;
    dateRange: number;
    periodMode: StatPeriodMode;
    periodOffset: StatPeriodOffset;
    refreshKey: number;
}

function average(values: number[]): number | undefined {
    return values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : undefined;
}

function buildPoints(
    from: Date,
    to: Date,
    entries: StatFocusTimeEntry[],
    aggregateWeekly: boolean,
): StatChartPoint[] {
    const focusByDate = new Map(entries.map(entry => [entry.date, entry.totalFocusSeconds / 60]));
    const days = eachDayOfInterval({ start: from, end: to });
    if (!aggregateWeekly) {
        return days.map(day => ({
            date: format(day, 'yyyy-MM-dd'),
            value: focusByDate.get(format(day, 'yyyy-MM-dd')),
            comparisonValue: undefined,
            hoverTarget: 0,
        }));
    }

    const points: StatChartPoint[] = [];
    for (let index = 0; index < days.length; index += 7) {
        const week = days.slice(index, index + 7);
        const values = week
            .map(day => focusByDate.get(format(day, 'yyyy-MM-dd')))
            .filter((value): value is number => value !== undefined);
        points.push({
            date: format(week[0], 'yyyy-MM-dd'),
            bucketLabel: formatStatBucketRange(week[0], week[week.length - 1]),
            periodEnd: format(week[week.length - 1], 'yyyy-MM-dd'),
            value: average(values),
            comparisonValue: undefined,
            hoverTarget: 0,
        });
    }
    return points;
}

export const TaskFocusTimeChart = React.memo(function TaskFocusTimeChart({
    definition,
    dateRange,
    periodMode,
    periodOffset,
    refreshKey,
}: Props) {
    const theme = useTheme();
    const period = getStatPeriodWindow(dateRange, periodMode, periodOffset);
    const from = parseISO(period.from);
    const to = parseISO(period.to);
    const fromStr = period.from;
    const toStr = period.to;
    const aggregateWeekly = dateRange >= 365;
    const dataKey = `${definition.id}:${fromStr}:${toStr}`;
    const cachedEntries = statService.getCachedFocusTime(definition.id, fromStr, toStr);
    const hasCachedData = Boolean(cachedEntries);
    const [dataState, setDataState] = useState<{ key: string; points: StatChartPoint[] }>(() => ({
        key: dataKey,
        points: buildPoints(from, to, cachedEntries ?? [], aggregateWeekly),
    }));
    const hasRenderedDataRef = useRef(hasCachedData);
    const [loadingKey, setLoadingKey] = useState<string | null>(hasCachedData ? null : dataKey);
    const cachedPoints = cachedEntries
        ? buildPoints(from, to, cachedEntries, aggregateWeekly)
        : null;
    const points = dataState.key === dataKey ? dataState.points : cachedPoints ?? dataState.points;
    const loading = loadingKey === dataKey
        || (dataState.key !== dataKey && !cachedEntries && !hasRenderedDataRef.current);

    useEffect(() => {
        let cancelled = false;
        if (!statService.getCachedFocusTime(definition.id, fromStr, toStr) && !hasRenderedDataRef.current) {
            setLoadingKey(dataKey);
        }
        statService.getFocusTime(definition.id, fromStr, toStr)
            .then(entries => {
                if (!cancelled) {
                    setDataState({
                        key: dataKey,
                        points: buildPoints(parseISO(fromStr), parseISO(toStr), entries, aggregateWeekly),
                    });
                    hasRenderedDataRef.current = true;
                }
            })
            .catch(error => console.error('Failed to fetch task focus time chart data:', error))
            .finally(() => {
                if (!cancelled) setLoadingKey(current => current === dataKey ? null : current);
            });
        return () => { cancelled = true; };
    }, [aggregateWeekly, dataKey, definition.id, fromStr, refreshKey, toStr]);

    const durationDefinition: StatDefinition = {
        ...definition,
        name: `${definition.name} focus time`,
        type: 'DURATION',
        morality: 'NEUTRAL',
        minValue: undefined,
        maxValue: undefined,
        goodThreshold: null,
    };

    return (
        <Box sx={{ position: 'relative', opacity: loading ? 0.55 : 1, transition: 'opacity 120ms ease' }}>
            <DurationStatChart
                definition={durationDefinition}
                points={points}
                dateRange={dateRange}
                theme={theme}
            />
            {loading && (
                <CircularProgress
                    size={18}
                    sx={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'none' }}
                />
            )}
        </Box>
    );
});
