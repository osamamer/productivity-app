import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
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

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
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
                <Box key={wi} sx={{ ...gridStyle, mb: '4px' }}>
                    {week.map((day, di) => {
                        const dateKey = day ? format(day, 'yyyy-MM-dd') : null;
                        const hasEntry = dateKey ? valueMap.has(dateKey) : false;
                        const isYes = hasEntry && valueMap.get(dateKey!) === 1;
                        const isNo = hasEntry && valueMap.get(dateKey!) !== 1;

                        return (
                            <Box
                                key={di}
                                title={day ? format(day, 'MMMM d, yyyy') : undefined}
                                sx={{
                                    height: 62,
                                    minHeight: 52,
                                    borderRadius: 1,
                                    bgcolor: theme.palette.mode === 'dark'
                                        ? theme.palette.background.default
                                        : theme.palette.action.disabledBackground,
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'flex-start',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    opacity: day ? 1 : 0,
                                    border: '1.5px solid',
                                    borderColor: isYes
                                        ? `${theme.palette.success.main}66`
                                        : isNo
                                        ? `${theme.palette.error.main}66`
                                        : 'transparent',
                                }}
                            >
                                {day && (
                                    <>
                                        {/* Date number — bottom-left */}
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontSize: 10,
                                                color: 'text.secondary',
                                                lineHeight: 1,
                                                position: 'absolute',
                                                bottom: 4,
                                                left: 5,
                                            }}
                                        >
                                            {format(day, 'd')}
                                        </Typography>

                                        {/* Stamp — top-right */}
                                        {isYes && (
                                            <CheckCircleOutlineIcon
                                                sx={{
                                                    fontSize: 20,
                                                    color: theme.palette.success.main,
                                                    transform: 'rotate(-12deg)',
                                                    position: 'absolute',
                                                    top: 3,
                                                    right: 3,
                                                    filter: `drop-shadow(0 0 2px ${theme.palette.success.main}55)`,
                                                }}
                                            />
                                        )}
                                        {isNo && (
                                            <HighlightOffIcon
                                                sx={{
                                                    fontSize: 20,
                                                    color: theme.palette.error.main,
                                                    transform: 'rotate(12deg)',
                                                    position: 'absolute',
                                                    top: 3,
                                                    right: 3,
                                                    filter: `drop-shadow(0 0 2px ${theme.palette.error.main}55)`,
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            ))}

            {/* Legend */}
            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main', transform: 'rotate(-12deg)' }} />
                    <Typography variant="caption" color="text.secondary">Yes</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <HighlightOffIcon sx={{ fontSize: 14, color: 'error.main', transform: 'rotate(12deg)' }} />
                    <Typography variant="caption" color="text.secondary">No</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'action.disabledBackground' }} />
                    <Typography variant="caption" color="text.secondary">No data</Typography>
                </Stack>
            </Stack>
        </Box>
    );
}
