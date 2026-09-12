import React, { useRef, useState, useEffect } from 'react';
import {
    Box, Typography, CircularProgress, Stack, Popover,
    ToggleButton, ToggleButtonGroup, Alert, Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { format, eachDayOfInterval, getDay, getMonth, parseISO } from 'date-fns';
import { StatDefinition, StatEntry, StatEntryStatus } from '../../types/Stats';
import { statService } from '../../services/api/statService';
import { getBooleanChoiceColor, showStatFeedback } from '../../services/statFeedback';
import { formatStatBucketRange, getStatPeriodWindow, StatPeriodMode, StatPeriodOffset } from './statPeriod';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
    definition: StatDefinition;
    dateRange: number;
    periodMode: StatPeriodMode;
    periodOffset: StatPeriodOffset;
    refreshKey: number;
    onEntryChanged?: (definitionId: string) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

interface BooleanHeatmapBucket {
    from: Date;
    to: Date;
    bucketLabel?: string;
    average: number | null;
    doneDays: number;
    eligibleDays: number;
    recordedDays: number;
    notPlannedOnly: boolean;
}

interface HeatmapMonthSegment {
    key: string;
    label: string;
    start: number;
    span: number;
}

function entryMaps(entries: StatEntry[]): { values: Map<string, number>; statuses: Map<string, StatEntryStatus> } {
    return {
        values: new Map(entries.map(entry => [entry.date, entry.value])),
        statuses: new Map(entries.map(entry => [entry.date, entry.status ?? 'RECORDED'] as [string, StatEntryStatus])),
    };
}

function booleanPeriodAverages(
    days: Date[],
    valueMap: Map<string, number>,
    statusMap: Map<string, StatEntryStatus>,
    daysPerBucket: number,
): BooleanHeatmapBucket[] {
    const buckets: BooleanHeatmapBucket[] = [];
    for (let index = 0; index < days.length; index += daysPerBucket) {
        const bucketDays = days.slice(index, index + daysPerBucket);
        const bucketDates = bucketDays.map(day => format(day, 'yyyy-MM-dd'));
        const eligibleDates = bucketDates.filter(date => statusMap.get(date) !== 'NOT_PLANNED');
        const recordedValues = eligibleDates
            .map(date => valueMap.get(date))
            .filter((value): value is number => value !== undefined);
        const doneDays = recordedValues.reduce((total, value) => total + value, 0);
        buckets.push({
            from: bucketDays[0],
            to: bucketDays[bucketDays.length - 1],
            bucketLabel: daysPerBucket === 7
                ? formatStatBucketRange(bucketDays[0], bucketDays[bucketDays.length - 1])
                : undefined,
            average: eligibleDates.length > 0
                ? doneDays / eligibleDates.length
                : null,
            doneDays,
            eligibleDays: eligibleDates.length,
            recordedDays: recordedValues.length,
            notPlannedOnly: eligibleDates.length === 0,
        });
    }
    return buckets;
}

function heatmapBucketLabel(bucket: BooleanHeatmapBucket): string {
    const label = bucket.bucketLabel ?? `${format(bucket.from, 'MMM d')} – ${format(bucket.to, 'MMM d, yyyy')}`;
    if (bucket.notPlannedOnly) return `${label} · Not planned`;

    const average = Math.round((bucket.average ?? 0) * 100);
    const logged = bucket.recordedDays === 0
        ? 'no entries logged'
        : `${bucket.recordedDays} logged`;
    return `${label} · ${average}% · ${bucket.doneDays} of ${bucket.eligibleDays} days done · ${logged}`;
}

function splitHeatmapRows(buckets: BooleanHeatmapBucket[], rowCount: number): BooleanHeatmapBucket[][] {
    const rows: BooleanHeatmapBucket[][] = [];
    let offset = 0;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const remainingRows = rowCount - rowIndex;
        const rowSize = Math.ceil((buckets.length - offset) / remainingRows);
        rows.push(buckets.slice(offset, offset + rowSize));
        offset += rowSize;
    }
    return rows;
}

function monthSegments(buckets: BooleanHeatmapBucket[], showYear: boolean): HeatmapMonthSegment[] {
    const segments: HeatmapMonthSegment[] = [];
    buckets.forEach((bucket, index) => {
        const midpoint = new Date((bucket.from.getTime() + bucket.to.getTime()) / 2);
        const key = format(midpoint, 'yyyy-MM');
        const previous = segments[segments.length - 1];
        if (previous?.key === key) {
            previous.span += 1;
            return;
        }
        segments.push({
            key,
            label: format(midpoint, showYear && getMonth(midpoint) === 0 ? 'MMM yyyy' : 'MMM'),
            start: index,
            span: 1,
        });
    });
    return segments;
}

export const BooleanCalendarView = React.memo(function BooleanCalendarView({
    definition,
    dateRange,
    periodMode,
    periodOffset,
    refreshKey,
    onEntryChanged,
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
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const feedbackAnchorRef = useRef<HTMLElement | null>(null);

    const allDays = eachDayOfInterval({ start: from, end: to });
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

    const openEditor = (event: React.MouseEvent<HTMLElement>, date: string) => {
        event.stopPropagation();
        setEditValue(valueMap.get(date) ?? null);
        setEditStatus(statusMap.get(date) ?? 'RECORDED');
        setSaveError(null);
        feedbackAnchorRef.current = null;
        setPopover({ anchorEl: event.currentTarget, date });
    };

    const closeEditor = () => {
        setPopover(null);
        setEditValue(null);
        setEditStatus('RECORDED');
        setSaveError(null);
    };

    const saveEntry = async (
        nextStatus: StatEntryStatus = editStatus,
        nextValue: number | null = editValue,
    ) => {
        if (!popover) return;
        const activePopover = popover;
        setSaving(true);
        setSaveError(null);
        try {
            await statService.recordEntry({
                statDefinitionId: definition.id,
                date: activePopover.date,
                value: nextStatus === 'NOT_PLANNED' ? null : nextValue,
                status: nextStatus,
            });
            if (nextValue !== null && nextStatus !== 'NOT_PLANNED') {
                showStatFeedback(definition, nextValue, feedbackAnchorRef.current);
            }
            setValueState(previous => {
                if (previous.key !== dataKey) return previous;
                const values = new Map(previous.values);
                const statuses = new Map(previous.statuses);
                if (nextValue === null && nextStatus !== 'NOT_PLANNED') {
                    values.delete(activePopover.date);
                    statuses.delete(activePopover.date);
                } else {
                    values.set(activePopover.date, nextValue ?? 0);
                    statuses.set(activePopover.date, nextStatus);
                }
                return { ...previous, values, statuses };
            });
            onEntryChanged?.(definition.id);
            closeEditor();
        } catch (error) {
            console.error('Failed to save boolean stat entry:', error);
            setSaveError('Failed to save this value.');
        } finally {
            setSaving(false);
        }
    };

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const isHeatmap = dateRange > 30;
    const heatmapBucketDays = dateRange <= 90 ? 3 : 7;
    const heatmapBuckets = isHeatmap
        ? booleanPeriodAverages(allDays, valueMap, statusMap, heatmapBucketDays)
        : [];
    const heatmapRows = splitHeatmapRows(heatmapBuckets, dateRange <= 90 ? 2 : 4);
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
            {isHeatmap ? (
                <Box
                    sx={{
                        display: 'grid',
                        gap: dateRange <= 90 ? '9px' : '7px',
                        width: '100%',
                    }}
                    aria-label={`${definition.name} ${heatmapBucketDays}-day average heatmap`}
                >
                    {heatmapRows.map((row, rowIndex) => (
                        <Box key={`${row[0]?.from.toISOString()}-${rowIndex}`}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                                    minHeight: 16,
                                    mb: 0.5,
                                }}
                            >
                                {monthSegments(row, dateRange > 90).map(segment => (
                                    <Typography
                                        key={`${segment.key}-${segment.start}`}
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            gridColumn: `${segment.start + 1} / span ${segment.span}`,
                                            px: 0.5,
                                            fontSize: 10,
                                            lineHeight: '16px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {segment.label}
                                    </Typography>
                                ))}
                            </Box>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                                    gridAutoRows: dateRange <= 90 ? 28 : 22,
                                    gap: '5px',
                                }}
                            >
                                {row.map((bucket, index) => (
                                    <Tooltip
                                        key={`${bucket.from.toISOString()}-${index}`}
                                        title={heatmapBucketLabel(bucket)}
                                        placement="top"
                                        arrow
                                    >
                                        <Box
                                            tabIndex={0}
                                            aria-label={heatmapBucketLabel(bucket)}
                                            sx={{
                                                minWidth: 0,
                                                borderRadius: 0.75,
                                                bgcolor: bucket.average == null
                                                    ? theme.palette.action.hover
                                                    : alpha(theme.palette.primary.main, 0.14 + bucket.average * 0.86),
                                                outline: '1px solid',
                                                outlineColor: bucket.average == null
                                                    ? theme.palette.action.disabledBackground
                                                    : alpha(theme.palette.primary.main, 0.2 + bucket.average * 0.45),
                                                outlineOffset: -1,
                                                transition: 'transform 100ms ease, outline-color 100ms ease',
                                                '&:hover, &:focus-visible': {
                                                    transform: 'translateY(-1px)',
                                                    outlineColor: theme.palette.primary.main,
                                                },
                                            }}
                                        />
                                    </Tooltip>
                                ))}
                            </Box>
                        </Box>
                    ))}
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

            {!isHeatmap && (
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
                            p: 0.5,
                            minWidth: 0,
                            bgcolor: 'background.paper',
                            boxShadow: 3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
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
                            disabled={saving}
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
                                borderRadius: 0,
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
                                    minWidth: 32,
                                    width: 32,
                                    height: 28,
                                    p: 0,
                                    border: 0,
                                    bgcolor: 'transparent',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '& .MuiSvgIcon-root': { fontSize: 18 },
                                },
                            }}
                        >
                            <ToggleButton
                                value="no"
                                aria-label="No"
                                title="No"
                                onClick={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                sx={{ '&.Mui-selected': { bgcolor: 'transparent', color: `${getBooleanChoiceColor(definition, 0)}.main` } }}
                            >
                                <HighlightOffIcon />
                            </ToggleButton>
                            <ToggleButton
                                value="not-planned"
                                aria-label="Unplanned"
                                title="Unplanned"
                                sx={{ '&.Mui-selected': { bgcolor: 'transparent', color: 'notPlanned.main' } }}
                            >
                                <RemoveCircleOutlineIcon />
                            </ToggleButton>
                            <ToggleButton
                                value="yes"
                                aria-label="Yes"
                                title="Yes"
                                onClick={event => { feedbackAnchorRef.current = event.currentTarget; }}
                                sx={{ '&.Mui-selected': { bgcolor: 'transparent', color: `${getBooleanChoiceColor(definition, 1)}.main` } }}
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
