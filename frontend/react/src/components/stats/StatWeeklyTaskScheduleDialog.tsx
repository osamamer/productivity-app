import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, DialogActions, DialogContent, DialogTitle,
    Popover, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { MouseEvent } from 'react';
import { AppTimeField } from '../input/AppPickerFields';
import { StatDefinition, StatWeeklyTaskScheduleDraft } from '../../types/Stats';
import {
    normalizeStatWeekStartDate, STAT_RECURRENCE_DAYS, defaultStatWeeklyTaskScheduleDraft,
    isStatScheduleDayAvailable,
} from './statRecurringTaskUtils';
import { MAX_STAT_TASK_SCHEDULE_WEEKS, StatTaskSchedulePeriodFields } from './StatTaskSchedulePeriodFields';

type PopupPosition = { top: number; left: number };

type Props = {
    open: boolean;
    definition: StatDefinition | null;
    saving?: boolean;
    loading?: boolean;
    error?: string | null;
    anchorPosition?: PopupPosition | null;
    initialDraft?: StatWeeklyTaskScheduleDraft | null;
    onWeekChange: (weekStartDate: string) => void;
    onClose: () => void;
    onConfirm: (draft: StatWeeklyTaskScheduleDraft, keepRepeating: boolean) => void;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function priorityBucket(importance: number): number {
    if (importance > 7) return 9;
    if (importance > 4) return 6;
    return 3;
}

export function StatWeeklyTaskScheduleDialog({
    open,
    definition,
    saving = false,
    loading = false,
    error = null,
    anchorPosition = null,
    initialDraft = null,
    onWeekChange,
    onClose,
    onConfirm,
}: Props) {
    const [draft, setDraft] = useState<StatWeeklyTaskScheduleDraft>(defaultStatWeeklyTaskScheduleDraft());
    const [keepRepeating, setKeepRepeating] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDraft(current => initialDraft
            ? { ...initialDraft, weekCount: current.weekCount }
            : defaultStatWeeklyTaskScheduleDraft(definition?.name ?? ''));
        setKeepRepeating(false);
    }, [open, definition?.id, definition?.name, initialDraft]);

    const timeMissing = !/^\d{2}:\d{2}$/.test(draft.timeOfDay);
    const nameMissing = !draft.taskName.trim();
    const periodInvalid = !draft.weekStartDate || !Number.isInteger(draft.weekCount)
        || draft.weekCount < 1 || draft.weekCount > MAX_STAT_TASK_SCHEDULE_WEEKS;

    const updateDays = (_event: MouseEvent<HTMLElement>, selectedDays: typeof draft.daysOfWeek) => {
        setDraft(current => ({ ...current, daysOfWeek: selectedDays }));
    };

    const updateWeekStart = (selectedDate: string) => {
        const weekStartDate = normalizeStatWeekStartDate(selectedDate);
        setDraft(current => ({
            ...current,
            weekStartDate,
            daysOfWeek: current.daysOfWeek.filter(day =>
                isStatScheduleDayAvailable(day, current.timeOfDay, weekStartDate),
            ),
        }));
        if (weekStartDate) onWeekChange(weekStartDate);
    };

    return (
        <Popover
            open={open && Boolean(anchorPosition)}
            onClose={saving ? undefined : onClose}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? { top: 0, left: 0 }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
                paper: {
                    sx: {
                        width: { xs: 'calc(100vw - 24px)', sm: 400 },
                        maxHeight: 'calc(100vh - 24px)',
                        overflow: 'auto',
                    },
                },
            }}
        >
            <Box>
                <DialogTitle>Change task schedule{definition ? ` for ${definition.name}` : ''}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.5}>
                        <ToggleButtonGroup
                            exclusive
                            fullWidth
                            size="small"
                            value={keepRepeating ? 'ongoing' : 'weeks'}
                            onChange={(_, value: 'weeks' | 'ongoing' | null) => {
                                if (value) setKeepRepeating(value === 'ongoing');
                            }}
                            disabled={saving || loading}
                        >
                            <ToggleButton value="weeks">Selected weeks</ToggleButton>
                            <ToggleButton value="ongoing">Keep repeating</ToggleButton>
                        </ToggleButtonGroup>
                        {keepRepeating ? (
                            <Typography variant="body2" color="text.secondary">
                                This changes the recurring schedule for future tasks. It repeats every week on the selected days.
                            </Typography>
                        ) : (
                            <>
                                <StatTaskSchedulePeriodFields
                                    weekStartDate={draft.weekStartDate}
                                    weekCount={draft.weekCount}
                                    disabled={saving}
                                    onWeekStartDateChange={updateWeekStart}
                                    onWeekCountChange={weekCount => setDraft(current => ({ ...current, weekCount }))}
                                />
                                {loading && (
                                    <Typography variant="body2" color="text.secondary">
                                        Loading that week's tasks…
                                    </Typography>
                                )}
                            </>
                        )}
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                Days each week
                            </Typography>
                            <ToggleButtonGroup
                                value={draft.daysOfWeek}
                                onChange={updateDays}
                                aria-label="Days each week"
                                disabled={saving || (!keepRepeating && loading)}
                                fullWidth
                                size="small"
                            >
                                {STAT_RECURRENCE_DAYS.map(day => (
                                    <ToggleButton
                                        key={day.value}
                                        value={day.value}
                                        aria-label={day.value}
                                        disabled={!keepRepeating && !isStatScheduleDayAvailable(
                                            day.value,
                                            draft.timeOfDay,
                                            draft.weekStartDate,
                                        )}
                                    >
                                        {day.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>
                        <AppTimeField
                            label="Task time"
                            value={draft.timeOfDay}
                            onChange={timeOfDay => setDraft(current => ({
                                ...current,
                                timeOfDay,
                                daysOfWeek: current.daysOfWeek.filter(day => keepRepeating
                                    || isStatScheduleDayAvailable(day, timeOfDay, current.weekStartDate)),
                            }))}
                            disabled={saving || (!keepRepeating && loading)}
                            error={timeMissing}
                            helperText={timeMissing ? 'Choose a task time.' : undefined}
                        />
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                Priority
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                {PRIORITY_OPTIONS.map(option => {
                                    const selected = priorityBucket(draft.importance) === option.value;
                                    return (
                                        <Chip
                                            key={option.label}
                                            label={option.label}
                                            onClick={() => setDraft(current => ({
                                                ...current,
                                                importance: option.value,
                                            }))}
                                            disabled={saving || (!keepRepeating && loading)}
                                            sx={{
                                                border: `1px solid ${option.color}`,
                                                color: selected ? '#fff' : option.color,
                                                backgroundColor: selected ? option.color : 'transparent',
                                                fontWeight: selected ? 600 : 400,
                                            }}
                                        />
                                    );
                                })}
                            </Stack>
                        </Box>
                        {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => onConfirm(draft, keepRepeating)}
                        disabled={saving || (!keepRepeating && loading) || !definition || nameMissing || timeMissing
                            || draft.daysOfWeek.length === 0 || (!keepRepeating && periodInvalid)}
                    >
                        {saving ? 'Saving…' : keepRepeating ? 'Save recurring schedule' : 'Schedule selected weeks'}
                    </Button>
                </DialogActions>
            </Box>
        </Popover>
    );
}
