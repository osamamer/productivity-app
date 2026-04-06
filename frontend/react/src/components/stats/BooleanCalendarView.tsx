import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, subDays, eachDayOfInterval, getDay } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { statService } from '../../services/api/statService';

// Week starts on Monday. Offset maps JS getDay() (0=Sun) to Mon-based index (0=Mon, 6=Sun).
const toMondayIndex = (jsDay: number) => (jsDay + 6) % 7;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
    definition: StatDefinition;
    dateRange: number;
    refreshKey: number;
}

export function BooleanCalendarView({ definition, dateRange, refreshKey }: Props) {
    const theme = useTheme();
    const [valueMap, setValueMap] = useState<Map<string, number>>(new Map());
    const [days, setDays] = useState<(Date | null)[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const to = new Date();
        const from = subDays(to, dateRange - 1);
        const fromStr = format(from, 'yyyy-MM-dd');
        const toStr = format(to, 'yyyy-MM-dd');

        // Pad the start so the first day aligns with its Mon-based column
        const allDays = eachDayOfInterval({ start: from, end: to });
        const startOffset = toMondayIndex(getDay(from));
        const padded: (Date | null)[] = [...Array(startOffset).fill(null), ...allDays];
        while (padded.length % 7 !== 0) padded.push(null);
        setDays(padded);

        setLoading(true);
        statService.getEntries(definition.id, fromStr, toStr)
            .then(entries => setValueMap(new Map(entries.map(e => [e.date, e.value]))))
            .catch(e => console.error('Failed to fetch boolean calendar entries:', e))
            .finally(() => setLoading(false));
    }, [definition.id, dateRange, refreshKey]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    const getCellBg = (day: Date | null): string => {
        if (!day) return 'transparent';
        const key = format(day, 'yyyy-MM-dd');
        if (!valueMap.has(key)) return theme.palette.action.disabledBackground;
        return valueMap.get(key) === 1 ? theme.palette.success.main : theme.palette.error.main;
    };

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
    };

    return (
        <Box>
            {/* Day-of-week column headers */}
            <Box sx={{ ...gridStyle, mb: 0.5 }}>
                {DAY_LABELS.map(label => (
                    <Box key={label} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            {label}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* Calendar grid — one row per week */}
            {weeks.map((week, wi) => (
                <Box key={wi} sx={{ ...gridStyle, mb: '2px' }}>
                    {week.map((day, di) => {
                        const dateKey = day ? format(day, 'yyyy-MM-dd') : null;
                        const hasEntry = dateKey ? valueMap.has(dateKey) : false;
                        return (
                            <Box
                                key={di}
                                title={day ? format(day, 'MMMM d, yyyy') : undefined}
                                sx={{
                                    height: 45,
                                    borderRadius: 1,
                                    bgcolor: getCellBg(day),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: day ? 'default' : undefined,
                                }}
                            >
                                {day && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: 10,
                                            color: hasEntry ? 'white' : 'text.secondary',
                                            fontWeight: hasEntry ? 600 : 400,
                                        }}
                                    >
                                        {format(day, 'd')}
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            ))}

            {/* Legend */}
            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                {[
                    { color: 'success.main', label: 'Yes' },
                    { color: 'error.main', label: 'No' },
                    { color: 'action.disabledBackground', label: 'No data' },
                ].map(({ color, label }) => (
                    <Stack key={label} direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}
