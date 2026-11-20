import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, ButtonBase, Button, Chip, Popover, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { format } from 'date-fns';
import { ActivityPicker } from '../../activity/ActivityPicker';
import { taskService } from '../../../services/api/taskService';
import { Activity } from '../../../types/Activity';
import { CalendarEventInput } from '../../../types/CalendarEvent';
import { Task } from '../../../types/Task';
import { priorityBand, rankFocusTaskChoices, scheduleLabel } from './focusTaskChoices';

export interface ChunkDraft {
    start: number;
    end: number;
    anchor: { top: number; left: number };
}

interface QuickChunkPopoverProps {
    draft: ChunkDraft | null;
    activities: Activity[];
    onClose: () => void;
    onCreate: (input: CalendarEventInput) => Promise<void>;
}

type ChunkKind = 'activity' | 'focus';
const MAX_TASK_CHOICES = 50;
const PRIORITY_TINT = { high: '#ef4444', medium: '#eab308' } as const;

function withTime(base: number, time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date(base);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
}

/** Plans a chunk of time from a click on the day view: an activity, or focus on a task, and when. */
export function QuickChunkPopover({ draft, activities, onClose, onCreate }: QuickChunkPopoverProps) {
    return (
        <Popover
            open={draft !== null}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={draft?.anchor}
            slotProps={{ paper: { sx: { p: 2, width: 340, maxWidth: 'calc(100vw - 32px)', borderRadius: 2 } } }}
        >
            {/* Keyed so each new draft starts with fresh fields. */}
            {draft && <ChunkForm key={`${draft.start}-${draft.end}`} draft={draft} activities={activities} onClose={onClose} onCreate={onCreate} />}
        </Popover>
    );
}

/** Loads the open tasks once, when the person first chooses to plan focus. */
function useOpenTasks(enabled: boolean): Task[] | null {
    const [tasks, setTasks] = useState<Task[] | null>(null);
    useEffect(() => {
        if (!enabled || tasks !== null) return;
        taskService.getAllMainTasks()
            .then(loaded => setTasks(loaded.filter(task => !task.completed)))
            .catch(error => {
                console.error('Could not load tasks for the focus block:', error);
                setTasks([]);
            });
    }, [enabled, tasks]);
    return tasks;
}

function TaskChoiceRow({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
    const band = priorityBand(task.importance);
    const tint = band === 'low' ? null : PRIORITY_TINT[band];
    return (
        <ButtonBase
            onClick={() => onSelect(task)}
            title={`${band[0].toUpperCase()}${band.slice(1)} priority`}
            sx={theme => ({
                flexShrink: 0,
                justifyContent: 'space-between',
                gap: 1,
                textAlign: 'left',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                backgroundColor: tint ? alpha(tint, 0.1) : 'transparent',
                '&:hover': { backgroundColor: tint ? alpha(tint, 0.18) : alpha(theme.palette.primary.main, 0.08) },
            })}
        >
            <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{task.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
                {scheduleLabel(task, new Date())}
            </Typography>
        </ButtonBase>
    );
}

function TaskChoice({ tasks, chunkStart, selected, onSelect }: { tasks: Task[] | null; chunkStart: number; selected: Task | null; onSelect: (task: Task | null) => void }) {
    const [query, setQuery] = useState('');
    const matches = useMemo(
        () => rankFocusTaskChoices(tasks ?? [], query, new Date(chunkStart)).slice(0, MAX_TASK_CHOICES),
        [query, tasks, chunkStart],
    );

    if (selected) {
        return (
            <Stack direction="row" alignItems="center" spacing={1}>
                <Chip label={`${selected.name} · ${scheduleLabel(selected, new Date())}`} onDelete={() => onSelect(null)} sx={{ maxWidth: '100%' }} />
            </Stack>
        );
    }
    return (
        <Stack spacing={0.75}>
            <TextField
                label="Task"
                size="small"
                value={query}
                onChange={event => setQuery(event.target.value)}
                autoComplete="off"
                autoFocus
                placeholder={tasks === null ? 'Loading tasks…' : 'Search your tasks'}
            />
            {tasks !== null && (
                <Stack spacing={0.25} sx={{ maxHeight: 216, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                    {matches.map(task => <TaskChoiceRow key={task.taskId} task={task} onSelect={onSelect} />)}
                    {matches.length === 0 && (
                        <Typography variant="caption" color="text.secondary">No open task matches.</Typography>
                    )}
                </Stack>
            )}
        </Stack>
    );
}

function ChunkForm({ draft, activities, onClose, onCreate }: Omit<QuickChunkPopoverProps, 'draft'> & { draft: ChunkDraft }) {
    const [kind, setKind] = useState<ChunkKind>('focus');
    const [activityId, setActivityId] = useState<string | null>(activities[0]?.id ?? null);
    const [title, setTitle] = useState(activities[0]?.name ?? '');
    const [task, setTask] = useState<Task | null>(null);
    const [start, setStart] = useState(format(draft.start, 'HH:mm'));
    const [end, setEnd] = useState(format(draft.end, 'HH:mm'));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const tasks = useOpenTasks(kind === 'focus');

    const chooseActivity = (nextId: string | null) => {
        const previousName = activities.find(activity => activity.id === activityId)?.name;
        const nextName = activities.find(activity => activity.id === nextId)?.name;
        if (nextName && (!title.trim() || title === previousName)) setTitle(nextName);
        setActivityId(nextId);
    };

    const chooseKind = (next: ChunkKind) => {
        setError(null);
        setKind(next);
    };

    const save = async () => {
        const startMs = withTime(draft.start, start);
        const endMs = withTime(draft.start, end);
        if (kind === 'activity' && !title.trim()) return setError('Give it a name.');
        if (kind === 'focus' && !task) return setError('Pick the task to focus on.');
        if (!(endMs > startMs)) return setError('The end needs to be after the start.');
        setSaving(true);
        setError(null);
        try {
            const focused = kind === 'focus' ? task : null;
            await onCreate({
                title: focused ? focused.name : title.trim(),
                activityId: kind === 'activity' ? activityId : null,
                taskId: focused?.taskId ?? null,
                description: '',
                allDay: false,
                startDate: null,
                endDate: null,
                startTime: new Date(startMs).toISOString(),
                endTime: new Date(endMs).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                status: 'CONFIRMED',
                recurrenceFrequency: 'NONE',
                recurrenceEndDate: null,
                recurrenceInterval: null,
                recurrenceUnit: null,
                reminderMinutesBefore: null,
            });
            onClose();
        } catch (saveError) {
            console.error('Could not plan the chunk:', saveError);
            setError(saveError instanceof Error ? saveError.message : 'Could not save it.');
            setSaving(false);
        }
    };

    return (
        <Stack spacing={1.5} component="form" onSubmit={event => { event.preventDefault(); void save(); }}>
            <Typography variant="subtitle1" fontWeight={700}>Plan a chunk</Typography>
            <Stack direction="row" spacing={0.75} role="radiogroup" aria-label="What the time is for">
                {([['focus', 'Focus on a task'], ['activity', 'Activity']] as const).map(([value, label]) => (
                    <Chip
                        key={value}
                        label={label}
                        size="small"
                        role="radio"
                        aria-checked={kind === value}
                        variant={kind === value ? 'filled' : 'outlined'}
                        color={kind === value ? 'primary' : 'default'}
                        onClick={() => chooseKind(value)}
                    />
                ))}
            </Stack>
            {kind === 'activity' ? (
                <>
                    <ActivityPicker activities={activities} value={activityId} onChange={chooseActivity} />
                    <TextField label="Name" size="small" value={title} onChange={event => setTitle(event.target.value)} autoComplete="off" autoFocus={activities.length === 0} />
                </>
            ) : (
                <Box>
                    <TaskChoice tasks={tasks} chunkStart={withTime(draft.start, start)} selected={task} onSelect={setTask} />
                </Box>
            )}
            <Stack direction="row" spacing={1}>
                <TextField label="From" type="time" size="small" value={start} onChange={event => setStart(event.target.value)} sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Until" type="time" size="small" value={end} onChange={event => setEnd(event.target.value)} sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Plan it'}</Button>
            </Stack>
        </Stack>
    );
}
