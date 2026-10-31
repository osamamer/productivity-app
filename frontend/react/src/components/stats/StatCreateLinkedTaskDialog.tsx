import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, DialogActions, DialogContent, DialogTitle,
    Popover, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { StatDefinition, StatRecurringTaskDraft, StatWeeklyTaskScheduleDraft } from '../../types/Stats';
import {
    defaultStatRecurringTaskDraft, defaultStatWeeklyTaskScheduleDraft, STAT_RECURRENCE_DAYS,
    isStatScheduleDayAvailable,
} from './statRecurringTaskUtils';
import { StatRecurringTaskOptions } from './StatRecurringTaskDialog';
import { AppTimeField } from '../input/AppPickerFields';
import { TaskReminderPicker } from '../task/TaskReminderPicker';
import { MAX_STAT_TASK_SCHEDULE_WEEKS, StatTaskSchedulePeriodFields } from './StatTaskSchedulePeriodFields';

type PopupPosition = { top: number; left: number };

type Props = {
    open: boolean;
    definition: StatDefinition | null;
    saving?: boolean;
    error?: string | null;
    anchorPosition?: PopupPosition | null;
    onClose: () => void;
    onCreate: (
        taskName: string,
        importance: number,
        timeOfDay: string,
        reminderMinutesBefore: number | null,
    ) => void;
    onCreateRecurring: (taskName: string, recurrence: StatRecurringTaskDraft) => void;
    onScheduleWeeks: (schedule: StatWeeklyTaskScheduleDraft) => void;
};

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function scheduledAtToday(timeOfDay: string): string {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return /^\d{2}:\d{2}$/.test(timeOfDay) ? `${date}T${timeOfDay}:00` : '';
}

export function StatCreateLinkedTaskDialog({
    open,
    definition,
    saving = false,
    error = null,
    anchorPosition = null,
    onClose,
    onCreate,
    onCreateRecurring,
    onScheduleWeeks,
}: Props) {
    const [taskName, setTaskName] = useState('');
    const [importance, setImportance] = useState(3);
    const [mode, setMode] = useState<'once' | 'week' | 'recurring'>('once');
    const [timeOfDay, setTimeOfDay] = useState('');
    const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(null);
    const [recurrence, setRecurrence] = useState<StatRecurringTaskDraft>(defaultStatRecurringTaskDraft);
    const [weeklySchedule, setWeeklySchedule] = useState<StatWeeklyTaskScheduleDraft>(
        defaultStatWeeklyTaskScheduleDraft(),
    );

    useEffect(() => {
        if (!open) return;
        setTaskName(definition?.name ?? '');
        setImportance(3);
        setMode('once');
        const now = new Date();
        setTimeOfDay(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        setReminderMinutesBefore(null);
        setRecurrence(defaultStatRecurringTaskDraft());
        setWeeklySchedule(defaultStatWeeklyTaskScheduleDraft(definition?.name ?? ''));
    }, [definition?.id, definition?.name, open]);

    const trimmedTaskName = taskName.trim();
    const customDaysMissing = recurrence.recurrenceFrequency === 'CUSTOM'
        && recurrence.recurrenceDaysOfWeek.length === 0;
    const timeMissing = !/^\d{2}:\d{2}$/.test(recurrence.timeOfDay);
    const weeklyTimeMissing = !/^\d{2}:\d{2}$/.test(weeklySchedule.timeOfDay);
    const weeklyPeriodInvalid = !weeklySchedule.weekStartDate
        || !Number.isInteger(weeklySchedule.weekCount)
        || weeklySchedule.weekCount < 1
        || weeklySchedule.weekCount > MAX_STAT_TASK_SCHEDULE_WEEKS;
    const oneTimeMissing = !/^\d{2}:\d{2}$/.test(timeOfDay);
    const canCreate = Boolean(definition && trimmedTaskName && !saving
        && (mode === 'once'
            ? !oneTimeMissing
            : mode === 'week'
                ? weeklySchedule.daysOfWeek.length > 0 && !weeklyTimeMissing && !weeklyPeriodInvalid
                : !customDaysMissing && !timeMissing));

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
            <DialogTitle>
                Create linked task{definition ? ` for ${definition.name}` : ''}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        label="Task name"
                        value={taskName}
                        onChange={event => setTaskName(event.target.value)}
                        disabled={saving}
                    />
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                            Priority
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {PRIORITY_OPTIONS.map(option => {
                                const selected = importance === option.value;
                                return (
                                    <Chip
                                        key={option.label}
                                        label={option.label}
                                        onClick={() => setImportance(option.value)}
                                        disabled={saving}
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
                    {definition?.type === 'BOOLEAN' && (
                        <>
                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
                                value={mode}
                                onChange={(_, value: 'once' | 'week' | 'recurring' | null) => {
                                    if (value) setMode(value);
                                }}
                                disabled={saving}
                            >
                                <ToggleButton value="once">One-time</ToggleButton>
                                <ToggleButton value="week">Selected weeks</ToggleButton>
                                {!definition.recurringTaskSeriesId && (
                                    <ToggleButton value="recurring">Recurring</ToggleButton>
                                )}
                            </ToggleButtonGroup>
                            {mode === 'week' && (
                                <>
                                    <StatTaskSchedulePeriodFields
                                        weekStartDate={weeklySchedule.weekStartDate}
                                        weekCount={weeklySchedule.weekCount}
                                        disabled={saving}
                                        onWeekStartDateChange={weekStartDate => setWeeklySchedule(current => ({
                                            ...current,
                                            weekStartDate,
                                            daysOfWeek: current.daysOfWeek.filter(day =>
                                                isStatScheduleDayAvailable(day, current.timeOfDay, weekStartDate),
                                            ),
                                        }))}
                                        onWeekCountChange={weekCount => setWeeklySchedule(current => ({
                                            ...current,
                                            weekCount,
                                        }))}
                                    />
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                            Days each week
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={weeklySchedule.daysOfWeek}
                                            onChange={(_event, daysOfWeek) => setWeeklySchedule(current => ({
                                                ...current,
                                                daysOfWeek,
                                            }))}
                                            aria-label="Days this week"
                                            disabled={saving}
                                            fullWidth
                                            size="small"
                                        >
                                            {STAT_RECURRENCE_DAYS.map(day => (
                                                <ToggleButton
                                                    key={day.value}
                                                    value={day.value}
                                                    aria-label={day.value}
                                                    disabled={!isStatScheduleDayAvailable(
                                                        day.value,
                                                        weeklySchedule.timeOfDay,
                                                        weeklySchedule.weekStartDate,
                                                    )}
                                                >
                                                    {day.label}
                                                </ToggleButton>
                                            ))}
                                        </ToggleButtonGroup>
                                    </Box>
                                    <AppTimeField
                                        label="Task time"
                                        value={weeklySchedule.timeOfDay}
                                        onChange={timeOfDay => setWeeklySchedule(current => ({
                                            ...current,
                                            timeOfDay,
                                            daysOfWeek: current.daysOfWeek.filter(day =>
                                                isStatScheduleDayAvailable(day, timeOfDay, current.weekStartDate),
                                            ),
                                        }))}
                                        disabled={saving}
                                        error={weeklyTimeMissing}
                                        helperText={weeklyTimeMissing ? 'Choose a task time.' : undefined}
                                    />
                                </>
                            )}
                            {mode === 'recurring' && (
                                <StatRecurringTaskOptions
                                    value={{ ...recurrence, importance }}
                                    onChange={setRecurrence}
                                    showPriority={false}
                                    disabled={saving}
                                    timeError={timeMissing ? 'Choose a task time.' : undefined}
                                />
                            )}
                        </>
                    )}
                    {mode === 'once' && (
                        <>
                            <AppTimeField
                                label="Task time"
                                value={timeOfDay}
                                onChange={setTimeOfDay}
                                disabled={saving}
                                error={oneTimeMissing}
                                helperText={oneTimeMissing ? 'Choose a task time.' : undefined}
                            />
                            <TaskReminderPicker
                                value={reminderMinutesBefore}
                                scheduledAt={scheduledAtToday(timeOfDay)}
                                disabled={saving || oneTimeMissing}
                                onChange={setReminderMinutesBefore}
                            />
                        </>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => mode === 'recurring'
                        ? onCreateRecurring(trimmedTaskName, { ...recurrence, importance, taskName: trimmedTaskName })
                        : mode === 'week'
                            ? onScheduleWeeks({
                                ...weeklySchedule,
                                taskName: trimmedTaskName,
                                importance,
                            })
                            : onCreate(trimmedTaskName, importance, timeOfDay, reminderMinutesBefore)}
                    disabled={!canCreate}
                >
                    {saving ? 'Creating…' : mode === 'recurring'
                        ? 'Create recurring task'
                        : mode === 'week' ? 'Schedule tasks' : 'Create task'}
                </Button>
            </DialogActions>
            </Box>
        </Popover>
    );
}
