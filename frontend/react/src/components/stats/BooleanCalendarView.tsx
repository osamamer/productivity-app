import React, { useState, useEffect } from 'react';
import {
    Box, Typography, CircularProgress, Stack, Popover,
    ToggleButton, ToggleButtonGroup, Button, Alert,
} from '@mui/material';
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
    onEntryChanged?: () => void;
}

export function BooleanCalendarView({ definition, dateRange, refreshKey, onEntryChanged }: Props) {
    const theme = useTheme();
    const to = new Date();
    const from = subDays(to, dateRange - 1);
    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(to, 'yyyy-MM-dd');
    const dataKey = `${definition.id}:${fromStr}:${toStr}`;
    const cachedEntries = statService.getCachedEntries(definition.id, fromStr, toStr);
    const [valueState, setValueState] = useState<{ key: string; values: Map<string, number> }>(() => ({
        key: dataKey,
        values: new Map(cachedEntries?.map(entry => [entry.date, entry.value]) ?? []),
    }));
    const [loadingKey, setLoadingKey] = useState<string | null>(cachedEntries ? null : dataKey);
    const valueMap = valueState.key === dataKey
        ? valueState.values
        : new Map(cachedEntries?.map(entry => [entry.date, entry.value]) ?? []);
    const loading = loadingKey === dataKey || (valueState.key !== dataKey && !cachedEntries);
    const [popover, setPopover] = useState<{ anchorEl: HTMLElement; date: string } | null>(null);
    const [editValue, setEditValue] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const allDays = eachDayOfInterval({ start: from, end: to });
    const startOffset = toMondayIndex(getDay(from));
    const days: (Date | null)[] = [...Array(startOffset).fill(null), ...allDays];
    while (days.length % 7 !== 0) days.push(null);

    useEffect(() => {
        let cancelled = false;
        if (!statService.getCachedEntries(definition.id, fromStr, toStr)) setLoadingKey(dataKey);
        setPopover(null);
        statService.getEntries(definition.id, fromStr, toStr)
            .then(entries => {
                if (!cancelled) {
                    setValueState({
                        key: dataKey,
                        values: new Map(entries.map(entry => [entry.date, entry.value])),
                    });
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
        setSaveError(null);
        setPopover({ anchorEl: event.currentTarget, date });
    };

    const closeEditor = () => {
        setPopover(null);
        setEditValue(null);
        setSaveError(null);
    };

    const saveEntry = async () => {
        if (!popover || editValue === null) return;
        setSaving(true);
        setSaveError(null);
        try {
            await statService.recordEntry({
                statDefinitionId: definition.id,
                date: popover.date,
                value: editValue,
            });
            setValueState(previous => previous.key === dataKey
                ? { ...previous, values: new Map(previous.values).set(popover.date, editValue) }
                : previous);
            onEntryChanged?.();
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
                                onClick={day ? event => openEditor(event, dateKey!) : undefined}
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

            <Popover
                open={Boolean(popover) && valueState.key === dataKey}
                anchorEl={popover?.anchorEl}
                onClose={closeEditor}
                transitionDuration={0}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                slotProps={{ paper: { sx: { p: 2, minWidth: 210 } } }}
            >
                {popover && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                            {definition.name} — {format(new Date(popover.date + 'T12:00:00'), 'EEEE, MMM d')}
                        </Typography>
                        <ToggleButtonGroup
                            value={editValue === 1 ? 'yes' : editValue === 0 ? 'no' : null}
                            exclusive
                            onChange={(_, value) => setEditValue(value === 'yes' ? 1 : value === 'no' ? 0 : null)}
                            size="small"
                            fullWidth
                        >
                            <ToggleButton
                                value="yes"
                                sx={{ '&.Mui-selected': { bgcolor: 'success.main', color: 'white', '&:hover': { bgcolor: 'success.dark' } } }}
                            >
                                Yes
                            </ToggleButton>
                            <ToggleButton
                                value="no"
                                sx={{ '&.Mui-selected': { bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } } }}
                            >
                                No
                            </ToggleButton>
                        </ToggleButtonGroup>
                        {saveError && <Alert severity="error" sx={{ mt: 1.5 }}>{saveError}</Alert>}
                        <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            disabled={saving || editValue === null}
                            onClick={() => { void saveEntry(); }}
                            sx={{ mt: 1.5 }}
                        >
                            {saving ? <CircularProgress size={16} color="inherit" /> : 'Save value'}
                        </Button>
                    </Box>
                )}
            </Popover>
        </Box>
    );
}
