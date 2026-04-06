import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Box, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { statService } from '../../services/api/statService';

interface ChartPoint {
    date: string;
    value: number | undefined;
}

interface Props {
    definition: StatDefinition;
    dateRange: number;
    refreshKey: number;
}

export function StatLineChart({ definition, dateRange, refreshKey }: Props) {
    const theme = useTheme();
    const [data, setData] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const to = new Date();
        const from = subDays(to, dateRange - 1);
        const fromStr = format(from, 'yyyy-MM-dd');
        const toStr = format(to, 'yyyy-MM-dd');

        setLoading(true);
        statService.getEntries(definition.id, fromStr, toStr)
            .then(entries => {
                const entryMap = new Map(entries.map(e => [e.date, e.value]));
                const points = eachDayOfInterval({ start: from, end: to }).map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    return { date: dateStr, value: entryMap.get(dateStr) };
                });
                setData(points);
            })
            .catch(e => console.error('Failed to fetch stat entries for chart:', e))
            .finally(() => setLoading(false));
    }, [definition.id, dateRange, refreshKey]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    const yDomain: [number | string, number | string] = definition.type === 'RANGE'
        ? [definition.minValue!, definition.maxValue!]
        : ['auto', 'auto'];

    const tickFormat = dateRange <= 7
        ? (d: string) => format(parseISO(d), 'EEE')
        : (d: string) => format(parseISO(d), 'MMM d');

    const gradientId = `gradient-${definition.id}`;

    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                <Tooltip
                    labelFormatter={l => format(parseISO(l as string), 'MMMM d, yyyy')}
                    contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                        fontSize: 12,
                    }}
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
            </AreaChart>
        </ResponsiveContainer>
    );
}
