import {
    Box, Button, Chip, Divider, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { AppTimeField } from '../input/AppPickerFields';
import { DayTemplateEventRequest, DayTemplateTaskRequest } from '../../types/DayTemplate';

const TEMPLATE_MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

const STATUS_OPTIONS = [
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'TENTATIVE', label: 'Tentative' },
    { value: 'CANCELLED', label: 'Cancelled' },
] as const;

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function priorityValue(importance: number): number {
    if (importance > 7) return 9;
    if (importance > 4) return 6;
    return 3;
}

type Props = {
    events: DayTemplateEventRequest[];
    tasks: DayTemplateTaskRequest[];
    onAddEvent: () => void;
    onUpdateEvent: (index: number, updates: Partial<DayTemplateEventRequest>) => void;
    onRemoveEvent: (index: number) => void;
    onAddTask: () => void;
    onUpdateTask: (index: number, updates: Partial<DayTemplateTaskRequest>) => void;
    onRemoveTask: (index: number) => void;
};

export function DayTemplateEditor({
    events,
    tasks,
    onAddEvent,
    onUpdateEvent,
    onRemoveEvent,
    onAddTask,
    onUpdateTask,
    onRemoveTask,
}: Props) {
    return (
        <Stack spacing={2}>
            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Events</Typography>
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={onAddEvent}>
                    Add event
                </Button>
            </Stack>
            {events.map((event, index) => (
                <Box
                    key={`event-${index}`}
                    sx={{
                        p: 1.5,
                        border: theme => `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>Event {index + 1}</Typography>
                        <IconButton
                            size="small"
                            color="error"
                            aria-label={`Remove event ${index + 1}`}
                            onClick={() => onRemoveEvent(index)}
                        >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                    <Stack spacing={1.25}>
                        <TextField
                            label="Event title"
                            value={event.title}
                            onChange={inputEvent => onUpdateEvent(index, { title: inputEvent.target.value })}
                            fullWidth
                            size="small"
                        />
                        <TextField
                            label="Description"
                            value={event.description}
                            onChange={inputEvent => onUpdateEvent(index, { description: inputEvent.target.value })}
                            multiline
                            minRows={2}
                            maxRows={4}
                            fullWidth
                            size="small"
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={event.allDay}
                                        onChange={inputEvent => {
                                            const allDay = inputEvent.target.checked;
                                            onUpdateEvent(index, {
                                                allDay,
                                                startTime: allDay ? null : event.startTime || '09:00',
                                                endTime: allDay ? null : event.endTime || '10:00',
                                            });
                                        }}
                                    />
                                }
                                label="All day"
                            />
                            <TextField
                                select
                                label="Status"
                                value={event.status}
                                onChange={inputEvent => onUpdateEvent(index, {
                                    status: inputEvent.target.value as DayTemplateEventRequest['status'],
                                })}
                                size="small"
                                sx={{ minWidth: { sm: 150 } }}
                            >
                                {STATUS_OPTIONS.map(option => (
                                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        {!event.allDay && (
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                                <AppTimeField
                                    label="Start time"
                                    value={event.startTime ?? ''}
                                    onChange={value => onUpdateEvent(index, { startTime: value || null })}
                                />
                                <AppTimeField
                                    label="End time"
                                    value={event.endTime ?? ''}
                                    onChange={value => onUpdateEvent(index, { endTime: value || null })}
                                />
                            </Stack>
                        )}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                            <TextField
                                label="Time zone"
                                value={event.timeZone}
                                onChange={inputEvent => onUpdateEvent(index, { timeZone: inputEvent.target.value })}
                                size="small"
                                fullWidth
                            />
                            <TextField
                                label="Reminder (minutes before)"
                                type="number"
                                value={event.reminderMinutesBefore ?? ''}
                                onChange={inputEvent => onUpdateEvent(index, {
                                    reminderMinutesBefore: inputEvent.target.value === ''
                                        ? null
                                        : Number(inputEvent.target.value),
                                })}
                                inputProps={{ min: 0, max: TEMPLATE_MAX_REMINDER_MINUTES, step: 1 }}
                                size="small"
                                fullWidth
                            />
                        </Stack>
                    </Stack>
                </Box>
            ))}
            {events.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    No events in this template.
                </Typography>
            )}

            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Tasks</Typography>
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={onAddTask}>
                    Add task
                </Button>
            </Stack>
            {tasks.map((task, index) => (
                <Box
                    key={`task-${index}`}
                    sx={{
                        p: 1.5,
                        border: theme => `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>Task {index + 1}</Typography>
                        <IconButton
                            size="small"
                            color="error"
                            aria-label={`Remove task ${index + 1}`}
                            onClick={() => onRemoveTask(index)}
                        >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                    <Stack spacing={1.25}>
                        <TextField
                            label="Task name"
                            value={task.name}
                            onChange={inputEvent => onUpdateTask(index, { name: inputEvent.target.value })}
                            fullWidth
                            size="small"
                        />
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                Priority
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.75 }}>
                                {PRIORITY_OPTIONS.map(option => {
                                    const selected = priorityValue(task.importance) === option.value;
                                    return (
                                        <Chip
                                            key={option.label}
                                            label={option.label}
                                            size="small"
                                            onClick={() => onUpdateTask(index, { importance: option.value })}
                                            sx={{
                                                border: `1px solid ${option.color}`,
                                                color: selected ? '#fff' : option.color,
                                                backgroundColor: selected ? option.color : 'transparent',
                                                cursor: 'pointer',
                                                fontWeight: selected ? 600 : 400,
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                        <AppTimeField
                            label="Scheduled"
                            value={task.scheduledTime ?? ''}
                            onChange={value => onUpdateTask(index, { scheduledTime: value || null })}
                        />
                        <TextField
                            label="Description"
                            value={task.description}
                            onChange={inputEvent => onUpdateTask(index, { description: inputEvent.target.value })}
                            multiline
                            minRows={2}
                            maxRows={4}
                            fullWidth
                            size="small"
                        />
                    </Stack>
                </Box>
            ))}
            {tasks.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    No tasks in this template.
                </Typography>
            )}
        </Stack>
    );
}
