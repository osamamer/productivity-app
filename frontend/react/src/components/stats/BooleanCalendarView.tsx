import React, { useRef, useState, useEffect } from 'react';
import {
    Box, Typography, CircularProgress, Stack, Popover,
    ToggleButton, ToggleButtonGroup, Alert,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { format, eachDayOfInterval, getDay, getMonth, parseISO } from 'date-fns';
import { StatDefinition, StatEntry, StatEntryStatus } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getBooleanChoiceColor, getStatFeedbackColor, showStatFeedback } from '../../services/statFeedback';
import { getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
    definition: StatDefinition;
    dateRange: number;
    periodMode: StatPeriodMode;
    periodOffset: StatPeriodOffset;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onError?: (message: string) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

function entryMaps(entries: StatEntry[]): { values: Map<string, number>; statuses: Map<string, StatEntryStatus> } {
    return {
        values: new Map(entries.map(entry => [entry.date, entry.value])),
        statuses: new Map(entries.map(entry => [entry.date, entry.status ?? 'RECORDED'] as [string, StatEntryStatus])),
    };
}

function calendarWeeks(days: Date[]): (Date | null)[][] {
    const calendarDays: (Date | null)[] = [...Array<Date | null>(getDay(days[0])).fill(null), ...days];
    while (calendarDays.length % 7 !== 0) calendarDays.push(null);
    const weeks: (Date | null)[][] = [];
    for (let index = 0; index < calendarDays.length; index += 7) {
        weeks.push(calendarDays.slice(index, index + 7));
    }
    return weeks;
}

function monthLabelsForWeeks(weeks: (Date | null)[][], showYear: boolean): string[] {
    let previousMonth = '';
    let firstMonth = true;
    return weeks.map(week => {
        const monthStart = week.find(day => day && format(day, 'yyyy-MM') !== previousMonth);
        if (!monthStart) return '';
        previousMonth = format(monthStart, 'yyyy-MM');
        if (firstMonth) {
            firstMonth = false;
            return '';
        }
        return format(monthStart, showYear && getMonth(monthStart) === 0 ? 'MMM yyyy' : 'MMM');
    });
}

export const BooleanCalendarView = React.memo(function BooleanCalendarView({
    definition,
    dateRange,
    periodMode,
    periodOffset,
    refreshKey,
    onEntryChanged,
    onError,
    onDateContextMenu,
}: Props) {
    const theme = useTheme();
    const yesColor = theme.palette[getBooleanChoiceColor(definition, 1)].main;
    const noColor = theme.palette[getBooleanChoiceColor(definition, 0)].main;
    const period = getStatPeriodWindow(dateRange, periodMode, periodOffset);
    const from = parseISO(period.from);
    const to = parseISO(period.to);
    const fromStr = period.from;
    const toStr = period.to;
    const dataKey = `${definition.id}:${fromStr}:${toStr}`;
    const cachedEntries = statService.getCachedEntries(definition.id, fromStr, toStr);
    const cachedMaps = cachedEntries ? entryMaps(cachedEntries) : null;
    const [valueState, setValueState] = useState<{
        key: string;
        values: Map<string, number>;
        statuses: Map<string, StatEntryStatus>;
    }>(() => ({
        key: dataKey,
        values: cachedMaps?.values ?? new Map(),
        statuses: cachedMaps?.statuses ?? new Map(),
    }));
    const hasRenderedDataRef = useRef(Boolean(cachedEntries));
    const [loadingKey, setLoadingKey] = useState<string | null>(cachedEntries ? null : dataKey);
    const valueMap = valueState.key === dataKey
        ? valueState.values
        : cachedMaps
            ? cachedMaps.values
            : valueState.values;
    const statusMap = valueState.key === dataKey
        ? valueState.statuses
        : cachedMaps
            ? cachedMaps.statuses
            : valueState.statuses;
    const loading = loadingKey === dataKey
        || (valueState.key !== dataKey && !cachedEntries && !hasRenderedDataRef.current);
    const [popover, setPopover] = useState<{ anchorEl: HTMLElement; date: string } | null>(null);
    const [editValue, setEditValue] = useState<number | null>(null);
    const [editStatus, setEditStatus] = useState<StatEntryStatus>('RECORDED');
    const [saveError, setSaveError] = useState<string | null>(null);
    const entryMutationVersionsRef = useRef(new Map<string, number>());
    const dailyGridRef = useRef<HTMLDivElement | null>(null);
    const [dailyGridWidth, setDailyGridWidth] = useState(0);

    const allDays = eachDayOfInterval({ start: from, end: to });
    const isDailyGrid = dateRange >= 90;
    const dailyWeeks = isDailyGrid ? calendarWeeks(allDays) : [];
    const dailyMonthLabels = monthLabelsForWeeks(dailyWeeks, dateRange > 90);
    const dailyGridGap = 2;
    const dailyGridAxisWidth = 26;
    const dailyGridCellSize = dailyGridWidth > 0
        ? Math.max(21, Math.min(
            24,
            Math.floor((dailyGridWidth - dailyGridAxisWidth - 6 - dailyGridGap * (dailyWeeks.length - 1)) / dailyWeeks.length),
        ))
        : 24;
    const startOffset = getDay(from);
    const days: (Date | null)[] = [...Array(startOffset).fill(null), ...allDays];
    while (days.length % 7 !== 0) days.push(null);

    useEffect(() => {
        let cancelled = false;
        if (!statService.getCachedEntries(definition.id, fromStr, toStr)
            && !hasRenderedDataRef.current) {
            setLoadingKey(dataKey);
        }
        setPopover(null);
        statService.getEntries(definition.id, fromStr, toStr)
            .then(entries => {
                if (!cancelled) {
                    setValueState({
                        key: dataKey,
                        ...entryMaps(entries),
                    });
                    hasRenderedDataRef.current = true;
                }
            })
            .catch(e => console.error('Failed to fetch boolean calendar entries:', e))
            .finally(() => {
                if (!cancelled) setLoadingKey(current => current === dataKey ? null : current);
            });
        return () => { cancelled = true; };
    }, [dataKey, definition.id, fromStr, refreshKey, toStr]);

    useEffect(() => {
        if (!isDailyGrid || !dailyGridRef.current) return;
        const element = dailyGridRef.current;
        const updateWidth = () => setDailyGridWidth(element.getBoundingClientRect().width);
        updateWidth();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, [isDailyGrid]);

    const openEditor = (event: React.MouseEvent<HTMLElement>, date: string) => {
        event.stopPropagation();
        setEditValue(valueMap.get(date) ?? null);
        setEditStatus(statusMap.get(date) ?? 'RECORDED');
        setSaveError(null);
        setPopover({ anchorEl: event.currentTarget, date });
    };

    const closeEditor = () => {
        setPopover(null);
        setEditValue(null);
        setEditStatus('RECORDED');
        setSaveError(null);
    };

    const saveEntry = (
        nextStatus: StatEntryStatus = editStatus,
        nextValue: number | null = editValue,
    ) => {
        if (!popover) return;
        const activePopover = popover;
        const previousValue = valueMap.get(activePopover.date);
        const previousStatus = statusMap.get(activePopover.date);
        const previousHadEntry = valueMap.has(activePopover.date);
        // The editor unmounts before the request resolves, so preserve the source cell's position.
        const feedbackAnchor = activePopover.anchorEl.getBoundingClientRect();
        const mutationVersion = (entryMutationVersionsRef.current.get(activePopover.date) ?? 0) + 1;
        entryMutationVersionsRef.current.set(activePopover.date, mutationVersion);

        setValueState(previous => {
            if (previous.key !== dataKey) return previous;
            const values = new Map(previous.values);
            const statuses = new Map(previous.statuses);
            if (nextValue === null && nextStatus !== 'NOT_PLANNED') {
                values.delete(activePopover.date);
                statuses.delete(activePopover.date);
            } else {
                values.set(activePopover.date, nextStatus === 'NOT_PLANNED' ? 0 : nextValue ?? 0);
                statuses.set(activePopover.date, nextStatus);
            }
            return { ...previous, values, statuses };
        });
        closeEditor();
        setSaveError(null);
        if (nextValue !== null && nextStatus !== 'NOT_PLANNED') {
            showStatFeedback(definition, nextValue, feedbackAnchor, {
                color: getStatFeedbackColor(definition, nextValue, theme),
            });
        }
        const savePromise = statService.recordEntry({
                statDefinitionId: definition.id,
                date: activePopover.date,
                value: nextStatus === 'NOT_PLANNED' ? null : nextValue,
                status: nextStatus,
            })
        onEntryChanged?.(definition.id);
        void savePromise.catch(error => {
                console.error('Failed to save boolean stat entry:', error);
                if (entryMutationVersionsRef.current.get(activePopover.date) === mutationVersion) {
                    setValueState(previous => {
                        if (previous.key !== dataKey) return previous;
                        const values = new Map(previous.values);
                        const statuses = new Map(previous.statuses);
                        if (previousHadEntry) {
                            values.set(activePopover.date, previousValue!);
                            statuses.set(activePopover.date, previousStatus ?? 'RECORDED');
                        } else {
                            values.delete(activePopover.date);
                            statuses.delete(activePopover.date);
                        }
                        return { ...previous, values, statuses };
                    });
                    onEntryChanged?.(definition.id);
                    setSaveError('Failed to save this value.');
                }
                onError?.('Failed to save this statistic.');
            });
    };

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const notPlannedColor = theme.palette.notPlanned.main;
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
    };

    return (
        <Box sx={{ position: 'relative', opacity: loading ? 0.55 : 1, transition: 'opacity 120ms ease' }}>
            {loading && (
                <CircularProgress
                    size={18}
                    sx={{ position: 'absolute', top: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}
                />
            )}
            {isDailyGrid ? (
                <Box
                    ref={dailyGridRef}
                    sx={{ width: '100%', overflowX: 'auto', pb: 0.5 }}
                    role="group"
                    aria-label={`${definition.name} daily history grid`}
                >
                    <Box sx={{ width: 'max-content', minWidth: '100%' }}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: `${dailyGridAxisWidth}px max-content`,
                                columnGap: '6px',
                                width: 'max-content',
                                mx: 'auto',
                                mb: 0.5,
                            }}
                        >
                            <Box aria-hidden="true" />
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${dailyWeeks.length}, ${dailyGridCellSize}px)`,
                                    columnGap: `${dailyGridGap}px`,
                                }}
                            >
                                {dailyMonthLabels.map((label, index) => (
                                    <Box key={`${label}-${index}`} sx={{ position: 'relative', height: 16, overflow: 'visible' }}>
                                        {label && (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ position: 'absolute', left: 4, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap' }}
                                            >
                                                {label}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: `${dailyGridAxisWidth}px max-content`,
                                columnGap: '6px',
                                width: 'max-content',
                                mx: 'auto',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateRows: `repeat(7, ${dailyGridCellSize}px)`,
                                    rowGap: `${dailyGridGap}px`,
                                }}
                            >
                                {DAY_LABELS.map((label, index) => (
                                    <Box key={label} sx={{ height: dailyGridCellSize, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {[1, 3, 5].includes(index) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1 }}>
                                                {label}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${dailyWeeks.length}, ${dailyGridCellSize}px)`,
                                    columnGap: `${dailyGridGap}px`,
                                }}
                            >
                                {dailyWeeks.map((week, weekIndex) => (
                                    <Box
                                        key={`week-${weekIndex}`}
                                        sx={{ display: 'grid', gridTemplateRows: `repeat(7, ${dailyGridCellSize}px)`, rowGap: `${dailyGridGap}px` }}
                                    >
                                        {week.map((day, dayIndex) => {
                                            if (!day) return <Box key={`empty-${dayIndex}`} aria-hidden="true" sx={{ width: dailyGridCellSize, height: dailyGridCellSize }} />;
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const hasEntry = valueMap.has(dateKey);
                                            const value = valueMap.get(dateKey);
                                            const status = statusMap.get(dateKey);
                                            const isNotPlanned = hasEntry && status === 'NOT_PLANNED';
                                            const isYes = hasEntry && !isNotPlanned && value === 1;
                                            const isNo = hasEntry && !isNotPlanned && value !== 1;
                                            const label = `${format(day, 'MMMM d, yyyy')}: ${isNotPlanned ? 'Not planned' : isYes ? 'Yes' : isNo ? 'No' : 'Not recorded'}`;
                                            const backgroundColor = isNotPlanned
                                                ? notPlannedColor
                                                : isYes
                                                    ? yesColor
                                                    : isNo
                                                        ? noColor
                                                        : theme.palette.action.disabledBackground;

                                            return (
                                                <Box
                                                    key={dateKey}
                                                    component="button"
                                                    type="button"
                                                    title={label}
                                                    aria-label={label}
                                                    onClick={event => openEditor(event, dateKey)}
                                                    onContextMenu={event => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        onDateContextMenu?.(dateKey, event);
                                                    }}
                                                    sx={{
                                                        width: dailyGridCellSize,
                                                        height: dailyGridCellSize,
                                                        p: 0,
                                                        border: 0,
                                                        appearance: 'none',
                                                        borderRadius: '2px',
                                                        bgcolor: backgroundColor,
                                                        cursor: 'pointer',
                                                        '&:hover, &:focus-visible': { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 1, zIndex: 1 },
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            ) : (
                <>
                    <Box sx={{ ...gridStyle, mb: 0.5 }}>
                        {DAY_LABELS.map(label => (
                            <Box key={label} sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                    {label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                    {weeks.map((week, wi) => (
                        <Box key={wi} sx={{ ...gridStyle, mb: '4px' }}>
                            {week.map((day, di) => {
                                const dateKey = day ? format(day, 'yyyy-MM-dd') : null;
                                const hasEntry = dateKey ? valueMap.has(dateKey) : false;
                                const value = dateKey ? valueMap.get(dateKey) : undefined;
                                const status = dateKey ? statusMap.get(dateKey) : undefined;
                                const isYes = hasEntry && value === 1;
                                const isNotPlanned = hasEntry && status === 'NOT_PLANNED';
                                const isNo = hasEntry && !isNotPlanned && value !== 1;
                                const stampColor = isNotPlanned ? notPlannedColor : isYes ? yesColor : noColor;

                                return (
                                    <Box
                                        key={di}
                                        title={day
                                            ? `${format(day, 'MMMM d, yyyy')}: ${isNotPlanned ? 'Not planned' : isYes ? 'Yes' : isNo ? 'No' : 'Not recorded'}`
                                            : undefined}
                                        onClick={day ? event => openEditor(event, dateKey!) : undefined}
                                        onContextMenu={day ? event => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            onDateContextMenu?.(dateKey!, event);
                                        } : undefined}
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
                                            cursor: day ? 'pointer' : 'default',
                                            border: '1.75px solid',
                                            borderColor: isYes || isNo || isNotPlanned
                                                ? alpha(stampColor, theme.palette.mode === 'light' ? 0.8 : 0.4)
                                                : 'transparent',
                                        }}
                                    >
                                        {day && (
                                            <>
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
                                                {isYes && (
                                                    <CheckCircleOutlineIcon
                                                        sx={{
                                                            fontSize: 20,
                                                            color: stampColor,
                                                            transform: 'rotate(-12deg)',
                                                            position: 'absolute',
                                                            top: 3,
                                                            right: 3,
                                                            filter: `drop-shadow(0 0 2px ${stampColor}55)`,
                                                        }}
                                                    />
                                                )}
                                                {isNo && (
                                                    <HighlightOffIcon
                                                        sx={{
                                                            fontSize: 20,
                                                            color: stampColor,
                                                            transform: 'rotate(12deg)',
                                                            position: 'absolute',
                                                            top: 3,
                                                            right: 3,
                                                            filter: `drop-shadow(0 0 2px ${stampColor}55)`,
                                                        }}
                                                    />
                                                )}
                                                {isNotPlanned && (
                                                    <RemoveCircleOutlineIcon
                                                        sx={{
                                                            fontSize: 20,
                                                            color: stampColor,
                                                            position: 'absolute',
                                                            top: 3,
                                                            right: 3,
                                                            filter: `drop-shadow(0 0 2px ${stampColor}55)`,
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
                </>
            )}

            {isDailyGrid ? (
                <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Yes', color: yesColor },
                        { label: 'No', color: noColor },
                        { label: 'No entry', color: theme.palette.action.disabledBackground },
                        { label: 'Not planned', color: notPlannedColor },
                    ].map(item => (
                        <Stack key={item.label} direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: item.color }} />
                            <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        </Stack>
                    ))}
                </Stack>
            ) : (
                <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <CheckCircleOutlineIcon sx={{ fontSize: 14, color: yesColor, transform: 'rotate(-12deg)' }} />
                        <Typography variant="caption" color="text.secondary">Yes</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <HighlightOffIcon sx={{ fontSize: 14, color: noColor, transform: 'rotate(12deg)' }} />
                        <Typography variant="caption" color="text.secondary">No</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: notPlannedColor }} />
                        <Typography variant="caption" color="text.secondary">Not planned</Typography>
                    </Stack>
                </Stack>
            )}

            <Popover
                open={Boolean(popover) && valueState.key === dataKey}
                anchorEl={popover?.anchorEl}
                onClose={closeEditor}
                transitionDuration={0}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 0,
                            minWidth: 0,
                            bgcolor: 'background.paper',
                            boxShadow: 3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 1,
                            overflow: 'hidden',
                        },
                    },
                }}
            >
                {popover && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ToggleButtonGroup
                            value={editStatus === 'NOT_PLANNED'
                                ? 'not-planned'
                                : editValue === 1 ? 'yes' : editValue === 0 ? 'no' : null}
                            exclusive
                            onChange={(_, value) => {
                                const nextStatus = value === 'not-planned' ? 'NOT_PLANNED' : 'RECORDED';
                                const nextValue = value === null ? null : value === 'yes' ? 1 : 0;
                                setEditStatus(nextStatus);
                                setEditValue(nextValue);
                                void saveEntry(nextStatus, nextValue);
                            }}
                            size="small"
                            sx={{
                                border: 0,
                                borderRadius: 1,
                                overflow: 'hidden',
                                bgcolor: 'transparent',
                                '& .MuiToggleButtonGroup-grouped': {
                                    border: '0 !important',
                                    borderRadius: 0,
                                    margin: 0,
                                },
                                '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
                                    borderLeft: '0 !important',
                                    marginLeft: 0,
                                },
                                '& .MuiToggleButton-root': {
                                    flex: '1 1 36px',
                                    minWidth: 36,
                                    width: 36,
                                    height: 32,
                                    p: 0,
                                    border: 0,
                                    bgcolor: 'transparent',
                                    color: 'text.secondary',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.action.active, 0.08),
                                    },
                                    '& .MuiSvgIcon-root': { fontSize: 18 },
                                },
                            }}
                        >
                            <ToggleButton
                                value="no"
                                aria-label="No"
                                title="No"
                                sx={{
                                    '&.Mui-selected': {
                                        bgcolor: alpha(noColor, theme.palette.mode === 'light' ? 0.16 : 0.28),
                                        color: noColor,
                                        '&:hover': { bgcolor: alpha(noColor, theme.palette.mode === 'light' ? 0.24 : 0.36) },
                                    },
                                }}
                            >
                                <HighlightOffIcon />
                            </ToggleButton>
                            <ToggleButton
                                value="not-planned"
                                aria-label="Unplanned"
                                title="Unplanned"
                                sx={{
                                    '&.Mui-selected': {
                                        bgcolor: alpha(notPlannedColor, theme.palette.mode === 'light' ? 0.16 : 0.28),
                                        color: notPlannedColor,
                                        '&:hover': { bgcolor: alpha(notPlannedColor, theme.palette.mode === 'light' ? 0.24 : 0.36) },
                                    },
                                }}
                            >
                                <RemoveCircleOutlineIcon />
                            </ToggleButton>
                            <ToggleButton
                                value="yes"
                                aria-label="Yes"
                                title="Yes"
                                sx={{
                                    '&.Mui-selected': {
                                        bgcolor: alpha(yesColor, theme.palette.mode === 'light' ? 0.16 : 0.28),
                                        color: yesColor,
                                        '&:hover': { bgcolor: alpha(yesColor, theme.palette.mode === 'light' ? 0.24 : 0.36) },
                                    },
                                }}
                            >
                                <CheckCircleOutlineIcon />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        {saveError && <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>}
                    </Box>
                )}
            </Popover>
        </Box>
    );
});
