import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    Alert,
    Box,
    IconButton,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isAfter, startOfMonth } from 'date-fns';
import { statService } from '../../services/api/statService';
import { StatDefinition, StatEntry, StatSummary } from '../../types/Stats';

const MEDITATED_SYSTEM_KEY = 'meditated';
const MEDITATION_MINUTES_SYSTEM_KEY = 'meditation_minutes';

interface MeditationStatsData {
    meditatedSummary: StatSummary;
    minutesSummary: StatSummary;
    meditatedEntries: StatEntry[];
    period: MeditationPeriod;
}

interface MeditationPeriod {
    from: string;
    to: string;
    monthStart: Date;
    monthEnd: Date;
}

interface MetricProps {
    icon: ReactNode;
    label: string;
    value: string;
    tint: string;
}

function Metric({ icon, label, value, tint }: MetricProps) {
    return (
        <Box sx={{
            p: { xs: 1.5, sm: 2 },
            minWidth: 0,
        }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: tint, mb: 1 }}>
                {icon}
                <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={700} lineHeight={1.1} noWrap>
                {value}
            </Typography>
        </Box>
    );
}

function formatMinutes(value: number): string {
    const rounded = Math.round(value);
    if (rounded < 60) return `${rounded} min`;
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function findSystemDefinition(definitions: StatDefinition[], systemKey: string): StatDefinition | undefined {
    return definitions.find(definition => definition.systemKey === systemKey);
}

interface MeditationStatsProps {
    refreshKey: number;
}

export function MeditationStats({ refreshKey }: MeditationStatsProps) {
    const theme = useTheme();
    const [data, setData] = useState<MeditationStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [monthOffset, setMonthOffset] = useState(0);
    const period = useMemo<MeditationPeriod>(() => {
        const today = new Date();
        const from = addMonths(startOfMonth(today), monthOffset);
        const monthEnd = endOfMonth(from);
        const to = monthOffset === 0 && isAfter(monthEnd, today) ? today : monthEnd;
        return {
            from: format(from, 'yyyy-MM-dd'),
            to: format(to, 'yyyy-MM-dd'),
            monthStart: from,
            monthEnd,
        };
    }, [monthOffset]);

    useEffect(() => {
        let cancelled = false;
        if (refreshKey > 0) statService.clearDataCache();
        setLoading(true);
        setError(false);
        statService.getDefinitions()
            .then(async definitions => {
                const meditated = findSystemDefinition(definitions, MEDITATED_SYSTEM_KEY);
                const minutes = findSystemDefinition(definitions, MEDITATION_MINUTES_SYSTEM_KEY);
                if (!meditated || !minutes) return;

                const [meditatedSummary, minutesSummary, meditatedEntries] = await Promise.all([
                    statService.getSummary(meditated.id, period.from, period.to),
                    statService.getSummary(minutes.id, period.from, period.to),
                    statService.getEntries(meditated.id, period.from, period.to),
                ]);
                if (!cancelled) setData({ meditatedSummary, minutesSummary, meditatedEntries, period });
            })
            .catch(fetchError => {
                console.error('Failed to load meditation stats:', fetchError);
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [period, refreshKey]);

    if (loading && !data) {
        return (
            <Box sx={{ width: '100%', p: { xs: 2, sm: 3, lg: 4 }, minHeight: { xs: 460, sm: 480, md: 460 }, boxSizing: 'border-box' }}>
                <Stack spacing={2.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Skeleton variant="circular" width={40} height={40} />
                            <Box>
                                <Skeleton variant="text" width={120} />
                                <Skeleton variant="text" width={180} />
                            </Box>
                        </Stack>
                        <Skeleton variant="rounded" width={125} height={32} />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                        <Skeleton variant="rounded" height={76} sx={{ flex: 1 }} />
                        <Skeleton variant="rounded" height={76} sx={{ flex: 1 }} />
                    </Stack>
                    <Box>
                        <Skeleton variant="text" width="55%" />
                        <Skeleton variant="rounded" height={210} />
                    </Box>
                </Stack>
            </Box>
        );
    }

    if (error && !data) {
        return (
            <Box sx={{ minHeight: { xs: 460, sm: 480, md: 460 }, p: { xs: 2, sm: 3, lg: 4 }, boxSizing: 'border-box' }}>
                <Alert severity="warning">Your meditation history could not be loaded.</Alert>
            </Box>
        );
    }
    if (!data) return null;

    const yesDates = new Set(
        data.meditatedEntries.filter(entry => entry.value === 1).map(entry => entry.date),
    );
    const monthDays = eachDayOfInterval({ start: data.period.monthStart, end: data.period.monthEnd });
    const leadingEmptyDays = (getDay(data.period.monthStart) + 6) % 7;
    const calendarDays: (Date | null)[] = [
        ...Array.from({ length: leadingEmptyDays }, () => null),
        ...monthDays,
    ];
    while (calendarDays.length < 42) calendarDays.push(null);
    const today = new Date();
    const yesCount = data.meditatedSummary.periodYesCount ?? 0;
    const totalMinutes = data.minutesSummary.periodTotal ?? 0;

    return (
        <Box
            sx={{
                width: '100%',
                p: { xs: 2, sm: 3, lg: 4 },
                minHeight: { xs: 460, sm: 480, md: 460 },
                boxSizing: 'border-box',
            }}
        >
            <Stack spacing={2.5}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                    useFlexGap
                    sx={{ flexWrap: 'wrap' }}
                >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            color: theme.palette.primary.main,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                        }}>
                            <SelfImprovementIcon />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={600}>Your practice</Typography>
                            <Typography variant="body2" color="text.secondary">A gentle look back at this month</Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.25} alignItems="center">
                        <IconButton
                            size="small"
                            aria-label="Previous month"
                            title="Previous month"
                            disabled={loading}
                            onClick={() => setMonthOffset(offset => offset - 1)}
                        >
                            <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary', minWidth: 132, justifyContent: 'center' }}>
                            <CalendarMonthIcon sx={{ fontSize: 18 }} />
                            <Typography variant="caption">{format(data.period.monthStart, 'MMMM yyyy')}</Typography>
                        </Stack>
                        <IconButton
                            size="small"
                            aria-label="Next month"
                            title="Next month"
                            disabled={loading || monthOffset >= 0}
                            onClick={() => setMonthOffset(offset => Math.min(0, offset + 1))}
                        >
                            <ChevronRightIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Stack>

                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 3,
                    overflow: 'hidden',
                }}>
                    <Metric
                        icon={<CheckCircleOutlineIcon fontSize="small" />}
                        label="Meditated"
                        value={`${yesCount} ${yesCount === 1 ? 'day' : 'days'}`}
                        tint={theme.palette.success.main}
                    />
                    <Box sx={{ borderLeft: `1px solid ${theme.palette.divider}` }}>
                        <Metric
                            icon={<AccessTimeIcon fontSize="small" />}
                            label="Meditation minutes"
                            value={formatMinutes(totalMinutes)}
                            tint={theme.palette.primary.main}
                        />
                    </Box>
                </Box>

                <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2">Practice calendar</Typography>
                        <Typography variant="caption" color="text.secondary">Mon – Sun</Typography>
                    </Stack>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        borderLeft: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: 'background.paper',
                    }}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <Typography
                                key={day}
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    py: 0.75,
                                    textAlign: 'center',
                                    fontSize: 10,
                                    borderRight: `1px solid ${theme.palette.divider}`,
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                }}
                            >
                                {day}
                            </Typography>
                        ))}
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return (
                                    <Box
                                        key={`empty-${index}`}
                                        sx={{
                                            height: { xs: 32, sm: 38 },
                                            borderRight: `1px solid ${theme.palette.divider}`,
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                        }}
                                    />
                                );
                            }
                            const key = format(date, 'yyyy-MM-dd');
                            const future = isAfter(date, today);
                            const practiced = !future && yesDates.has(key);
                            return (
                                <Tooltip key={key} title={future ? format(date, 'MMMM d') : `${format(date, 'MMMM d')}: ${practiced ? 'Meditated' : 'No session'}`}>
                                    <Box sx={{
                                        height: { xs: 32, sm: 38 },
                                        position: 'relative',
                                        bgcolor: practiced
                                            ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.28 : 0.18)
                                            : 'background.paper',
                                        borderRight: `1px solid ${theme.palette.divider}`,
                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                        opacity: future ? 0.45 : 1,
                                        display: 'grid',
                                        placeItems: 'center',
                                        transition: 'background-color 120ms ease',
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                                        },
                                    }}>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontSize: 10,
                                                color: practiced
                                                    ? theme.palette.mode === 'dark' ? theme.palette.success.light : theme.palette.success.dark
                                                    : theme.palette.text.secondary,
                                            }}
                                        >
                                            {format(date, 'd')}
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            );
                        })}
                    </Box>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 1.25 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.28 : 0.18) }} />
                            <Typography variant="caption" color="text.secondary">Meditated</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 12, height: 12, border: `1px solid ${theme.palette.divider}` }} />
                            <Typography variant="caption" color="text.secondary">No session</Typography>
                        </Stack>
                    </Stack>
                </Box>
            </Stack>
        </Box>
    );
}
