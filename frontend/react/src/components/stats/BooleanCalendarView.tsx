import React, { useRef, useState, useEffect } from 'react';
import {
    Box, Typography, CircularProgress, Stack, Popover, Button,
    Alert,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { format, eachDayOfInterval, getDay, getMonth, parseISO } from 'date-fns';
import { StatDefinition, StatEntry, StatEntryStatus, StatType } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getBooleanChoiceColor, getStatFeedbackColor, showStatFeedback } from '../../services/statFeedback';
import { getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';
import { SubStatInputFields } from './SubStatInputFields';
import { StatInputField } from './StatInputField';
import { statInputLabel } from './statInputLabels';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
    definition: StatDefinition;
    entryDefinition?: StatDefinition;
    additionalInputType?: StatType;
    subStatDefinitions?: StatDefinition[];
    dateRange: number;
    periodMode: StatPeriodMode;
    periodOffset: StatPeriodOffset;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onError?: (message: string) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

function entryMaps(entries: StatEntry[], additionalInputType?: StatType): {
    values: Map<string, number>;
    statuses: Map<string, StatEntryStatus>;
    entries: Map<string, StatEntry>;
} {
    return {
        values: new Map(entries.flatMap(entry => {
            const value = entry.status === 'NOT_PLANNED'
                ? 0
                : additionalInputType ? entry.additionalValues?.[additionalInputType] : entry.value;
            return value == null ? [] : [[entry.date, value] as [string, number]];
        })),
        statuses: new Map(entries.map(entry => [entry.date, entry.status ?? 'RECORDED'] as [string, StatEntryStatus])),
        entries: new Map(entries.map(entry => [entry.date, entry])),
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
    entryDefinition,
    additionalInputType,
    subStatDefinitions = [],
    dateRange,
    periodMode,
    periodOffset,
    refreshKey,
    onEntryChanged,
    onError,
    onDateContextMenu,
}: Props) {
    const recordDefinition = entryDefinition ?? definition;
    const theme = useTheme();
    const yesColor = theme.palette[getBooleanChoiceColor(definition, 1)].main;
    const noColor = theme.palette[getBooleanChoiceColor(definition, 0)].main;
    const period = getStatPeriodWindow(dateRange, periodMode, periodOffset);
    const from = parseISO(period.from);
    const to = parseISO(period.to);
    const fromStr = period.from;
    const toStr = period.to;
    const dataKey = `${recordDefinition.id}:${additionalInputType ?? 'main'}:${fromStr}:${toStr}`;
    const cachedEntries = statService.getCachedEntries(recordDefinition.id, fromStr, toStr);
    const cachedMaps = cachedEntries ? entryMaps(cachedEntries, additionalInputType) : null;
    const [valueState, setValueState] = useState<{
        key: string;
        values: Map<string, number>;
        statuses: Map<string, StatEntryStatus>;
        entries: Map<string, StatEntry>;
    }>(() => ({
        key: dataKey,
        values: cachedMaps?.values ?? new Map(),
        statuses: cachedMaps?.statuses ?? new Map(),
        entries: cachedMaps?.entries ?? new Map(),
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
    const entryMap = valueState.key === dataKey
        ? valueState.entries
        : cachedMaps
            ? cachedMaps.entries
            : valueState.entries;
    const loading = loadingKey === dataKey
        || (valueState.key !== dataKey && !cachedEntries && !hasRenderedDataRef.current);
    const [popover, setPopover] = useState<{ anchorEl: HTMLElement; date: string } | null>(null);
    const [editValue, setEditValue] = useState<number | null>(null);
    const [editStatus, setEditStatus] = useState<StatEntryStatus>('RECORDED');
    const [editAdditionalValues, setEditAdditionalValues] = useState<Partial<Record<StatType, number>>>({});
    const [saveError, setSaveError] = useState<string | null>(null);
    const entryMutationVersionsRef = useRef(new Map<string, number>());
    const forceRefreshOnMountRef = useRef(true);
    const dailyGridRef = useRef<HTMLDivElement | null>(null);
    const [dailyGridWidth, setDailyGridWidth] = useState(0);
    const additionalInputTypes = recordDefinition.additionalInputTypes ?? [];
    const hasEmbeddedInputs = additionalInputTypes.length > 0 || subStatDefinitions.length > 0;

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
        setPopover(null);
    }, [dataKey]);

    useEffect(() => {
        let cancelled = false;
        const forceRefresh = forceRefreshOnMountRef.current;
        forceRefreshOnMountRef.current = false;
        if (!statService.getCachedEntries(recordDefinition.id, fromStr, toStr)
            && !hasRenderedDataRef.current) {
            setLoadingKey(dataKey);
        }
        statService.getEntries(recordDefinition.id, fromStr, toStr, forceRefresh)
            .then(entries => {
                if (!cancelled) {
                    setValueState({
                        key: dataKey,
                        ...entryMaps(entries, additionalInputType),
                    });
                    hasRenderedDataRef.current = true;
                }
            })
            .catch(e => console.error('Failed to fetch boolean calendar entries:', e))
            .finally(() => {
                if (!cancelled) setLoadingKey(current => current === dataKey ? null : current);
            });
        return () => { cancelled = true; };
    }, [additionalInputType, dataKey, fromStr, recordDefinition.id, refreshKey, toStr]);

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
        setEditValue(entryMap.get(date)?.value ?? null);
        setEditStatus(statusMap.get(date) ?? 'RECORDED');
        setEditAdditionalValues(entryMap.get(date)?.additionalValues ?? {});
        setSaveError(null);
        setPopover({ anchorEl: event.currentTarget, date });
    };

    const closeEditor = () => {
        setPopover(null);
        setEditValue(null);
        setEditStatus('RECORDED');
        setEditAdditionalValues({});
        setSaveError(null);
    };

    const saveEntry = (
        nextStatus: StatEntryStatus = editStatus,
        nextValue: number | null = editValue,
    ) => {
        if (!popover) return;
        const activePopover = popover;
        const nextAdditionalValues = nextStatus === 'NOT_PLANNED'
            ? {}
            : Object.fromEntries(
                (recordDefinition.additionalInputTypes ?? [])
                    .filter(type => editAdditionalValues[type] != null)
                    .map(type => [type, editAdditionalValues[type]]),
            ) as Partial<Record<StatType, number>>;
        if (nextValue == null && nextStatus !== 'NOT_PLANNED' && Object.keys(nextAdditionalValues).length > 0) {
            setSaveError(`Choose a value for ${recordDefinition.name} before saving its additional inputs.`);
            return;
        }
        const previousValue = entryMap.get(activePopover.date)?.value;
        const previousStatus = statusMap.get(activePopover.date);
        const previousEntry = entryMap.get(activePopover.date);
        const previousHadEntry = entryMap.has(activePopover.date);
        const shouldRemoveEntry = nextValue === null
            && nextStatus !== 'NOT_PLANNED'
            && Object.keys(nextAdditionalValues).length === 0;
        // The editor unmounts before the request resolves, so preserve the source cell's position.
        const feedbackAnchor = activePopover.anchorEl.getBoundingClientRect();
        const mutationVersion = (entryMutationVersionsRef.current.get(activePopover.date) ?? 0) + 1;
        entryMutationVersionsRef.current.set(activePopover.date, mutationVersion);

        setValueState(previous => {
            if (previous.key !== dataKey) return previous;
            const values = new Map(previous.values);
            const statuses = new Map(previous.statuses);
            const entries = new Map(previous.entries);
            if (shouldRemoveEntry) {
                values.delete(activePopover.date);
                statuses.delete(activePopover.date);
                entries.delete(activePopover.date);
            } else {
                const primaryValue = nextStatus === 'NOT_PLANNED' ? 0 : nextValue ?? 0;
                const displayValue = nextStatus === 'NOT_PLANNED'
                    ? 0
                    : additionalInputType ? nextAdditionalValues[additionalInputType] : primaryValue;
                if (displayValue == null) values.delete(activePopover.date);
                else values.set(activePopover.date, displayValue);
                statuses.set(activePopover.date, nextStatus);
                entries.set(activePopover.date, {
                    ...(previousEntry ?? {}),
                    id: previousEntry?.id ?? `optimistic-${recordDefinition.id}-${activePopover.date}`,
                    statDefinitionId: recordDefinition.id,
                    statDefinition: recordDefinition,
                    date: activePopover.date,
                    value: primaryValue,
                    status: nextStatus,
                    additionalValues: nextAdditionalValues,
                    userId: previousEntry?.userId ?? recordDefinition.userId,
                });
            }
            return { ...previous, values, statuses, entries };
        });
        closeEditor();
        setSaveError(null);
        if (nextValue !== null && nextStatus !== 'NOT_PLANNED') {
            showStatFeedback(recordDefinition, nextValue, feedbackAnchor, {
                color: getStatFeedbackColor(recordDefinition, nextValue, theme),
            });
        }
        const savePromise = statService.recordEntry({
                statDefinitionId: recordDefinition.id,
                date: activePopover.date,
                value: nextStatus === 'NOT_PLANNED' ? null : nextValue,
                status: nextStatus,
                additionalValues: nextAdditionalValues,
            })
        onEntryChanged?.(recordDefinition.id);
        void savePromise.catch(error => {
                console.error('Failed to save boolean stat entry:', error);
                if (entryMutationVersionsRef.current.get(activePopover.date) === mutationVersion) {
                    setValueState(previous => {
                        if (previous.key !== dataKey) return previous;
                        const values = new Map(previous.values);
                        const statuses = new Map(previous.statuses);
                        const entries = new Map(previous.entries);
                        if (previousHadEntry) {
                            const displayValue = previousStatus === 'NOT_PLANNED'
                                ? 0
                                : additionalInputType
                                    ? previousEntry?.additionalValues?.[additionalInputType]
                                    : previousValue;
                            if (displayValue == null) values.delete(activePopover.date);
                            else values.set(activePopover.date, displayValue);
                            statuses.set(activePopover.date, previousStatus ?? 'RECORDED');
                            if (previousEntry) entries.set(activePopover.date, previousEntry);
                        } else {
                            values.delete(activePopover.date);
                            statuses.delete(activePopover.date);
                            entries.delete(activePopover.date);
                        }
                        return { ...previous, values, statuses, entries };
                    });
                    onEntryChanged?.(recordDefinition.id);
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
                            p: hasEmbeddedInputs ? 1.5 : 0,
                            minWidth: hasEmbeddedInputs ? 'min(300px, calc(100vw - 32px))' : 0,
                            maxWidth: 'min(360px, calc(100vw - 32px))',
                            bgcolor: 'background.paper',
                            boxShadow: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: hasEmbeddedInputs ? 'stretch' : 'center',
                            justifyContent: hasEmbeddedInputs ? 'flex-start' : 'center',
                            borderRadius: 1,
                            overflow: 'auto',
                        },
                    },
                }}
            >
                {popover && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <StatInputField
                            definition={recordDefinition}
                            type={recordDefinition.type}
                            value={editValue}
                            status={editStatus}
                            primary
                            onChange={(value, status) => {
                                const nextStatus = status ?? 'RECORDED';
                                setEditStatus(nextStatus);
                                setEditValue(value);
                                if (!hasEmbeddedInputs) void saveEntry(nextStatus, value);
                            }}
                            onFocus={() => undefined}
                        />
                        {additionalInputTypes.map(type => (
                            <Box key={type} sx={{ mt: 1.5, width: '100%' }}>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                    {statInputLabel(type)}
                                </Typography>
                                <StatInputField
                                    definition={recordDefinition}
                                    type={type}
                                    value={editAdditionalValues[type] ?? null}
                                    onChange={value => setEditAdditionalValues(previous => {
                                        const next = { ...previous };
                                        if (value == null) delete next[type];
                                        else next[type] = value;
                                        return next;
                                    })}
                                    onFocus={() => undefined}
                                />
                            </Box>
                        ))}
                        {saveError && <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>}
                        <SubStatInputFields
                            definitions={subStatDefinitions}
                            date={popover.date}
                            refreshKey={refreshKey}
                            onEntryChanged={onEntryChanged}
                            onError={onError}
                        />
                        {hasEmbeddedInputs && (
                            <Button size="small" variant="contained" onClick={() => saveEntry()} sx={{ mt: 1.5, alignSelf: 'flex-end' }}>
                                Save
                            </Button>
                        )}
                    </Box>
                )}
            </Popover>
        </Box>
    );
});
