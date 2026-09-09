import {
    Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Fade, Stack, TextField,
    ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useLayoutEffect, useMemo, useState } from 'react';
import { CalendarEvent } from '../../types/CalendarEvent';
import {
    DayTemplate, DayTemplateEventRequest, DayTemplateRequest, DayTemplateTaskRequest,
} from '../../types/DayTemplate';
import { Task } from '../../types/Task';
import { AppDateField } from '../input/AppPickerFields';
import { DayTemplateEditor } from './DayTemplateEditor';
import { buildDayTemplateRequest, formatTemplateDate } from './dayTemplateUtils';

function defaultEventDraft(): DayTemplateEventRequest {
    return {
        title: '',
        description: '',
        allDay: false,
        startTime: '09:00',
        endTime: '10:00',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        reminderMinutesBefore: null,
        status: 'CONFIRMED',
    };
}

function defaultTaskDraft(): DayTemplateTaskRequest {
    return {
        name: '',
        description: '',
        scheduledTime: null,
        tag: null,
        importance: 3,
    };
}

type Props = {
    open: boolean;
    initialDate: string;
    events: CalendarEvent[];
    tasks: Task[];
    template?: DayTemplate | null;
    onSave: (request: DayTemplateRequest) => Promise<void>;
    onClose: () => void;
};

type TemplateCreationMode = 'copy' | 'scratch';

export function DayTemplateCreationDialog({ open, initialDate, events, tasks, template = null, onSave, onClose }: Props) {
    const [name, setName] = useState('');
    const [sourceDate, setSourceDate] = useState(initialDate);
    const [creationMode, setCreationMode] = useState<TemplateCreationMode>('copy');
    const [eventDrafts, setEventDrafts] = useState<DayTemplateEventRequest[]>([]);
    const [taskDrafts, setTaskDrafts] = useState<DayTemplateTaskRequest[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useLayoutEffect(() => {
        if (!open) return;
        setName(template?.name ?? '');
        setSourceDate(initialDate);
        setCreationMode(template ? 'scratch' : 'copy');
        setEventDrafts(template?.events.map(event => ({
            title: event.title,
            description: event.description,
            allDay: event.allDay,
            startTime: event.startTime,
            endTime: event.endTime,
            timeZone: event.timeZone,
            reminderMinutesBefore: event.reminderMinutesBefore,
            status: event.status,
        })) ?? []);
        setTaskDrafts(template?.tasks.map(task => ({
            name: task.name,
            description: task.description,
            scheduledTime: task.scheduledTime,
            tag: task.tag,
            importance: task.importance,
        })) ?? []);
        setError(null);
    }, [initialDate, open, template]);

    const preview = useMemo(
        () => template || creationMode === 'scratch'
            ? {
                name: name.trim(),
                events: eventDrafts,
                tasks: taskDrafts,
            }
            : buildDayTemplateRequest(name, sourceDate, events, tasks),
        [creationMode, eventDrafts, events, name, sourceDate, taskDrafts, tasks, template],
    );

    const showEditor = Boolean(template) || creationMode === 'scratch';

    const updateEvent = (index: number, updates: Partial<DayTemplateEventRequest>) => {
        setEventDrafts(current => current.map((event, eventIndex) => eventIndex === index
            ? { ...event, ...updates }
            : event));
    };

    const updateTask = (index: number, updates: Partial<DayTemplateTaskRequest>) => {
        setTaskDrafts(current => current.map((task, taskIndex) => taskIndex === index
            ? { ...task, ...updates }
            : task));
    };

    const close = () => {
        if (saving) return;
        onClose();
    };

    const save = async () => {
        if (!name.trim()) {
            setError('Give the template a name.');
            return;
        }
        if (!template && creationMode === 'copy' && !sourceDate) {
            setError('Choose the day to copy.');
            return;
        }
        if (preview.events.length === 0 && preview.tasks.length === 0) {
            setError(showEditor
                ? 'A template must contain at least one event or task.'
                : 'The selected day must contain at least one event or task.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await onSave(preview);
            setName('');
            onClose();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save the day template.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            TransitionComponent={Fade}
            transitionDuration={{ enter: 180, exit: 140 }}
            fullWidth
            maxWidth={showEditor ? 'sm' : 'xs'}
            scroll="paper"
        >
            <DialogTitle>
                {template ? 'Edit day template' : creationMode === 'scratch' ? 'New day template' : 'Save day as template'}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {template
                            ? 'Update the name and schedule, then save your changes.'
                            : 'Give this template a name, then build its reusable schedule or copy one from a day.'}
                    </Typography>
                    <TextField
                        label="Template name"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        placeholder="e.g. Focus day"
                        slotProps={{ htmlInput: { maxLength: 120 } }}
                        fullWidth
                        autoFocus
                    />
                    {!template && (
                        <ToggleButtonGroup
                            exclusive
                            fullWidth
                            size="small"
                            value={creationMode}
                            onChange={(_, value: TemplateCreationMode | null) => {
                                if (!value) return;
                                setCreationMode(value);
                                if (value === 'scratch') {
                                    setEventDrafts([]);
                                    setTaskDrafts([]);
                                }
                                setError(null);
                            }}
                        >
                            <ToggleButton value="copy">Copy a day</ToggleButton>
                            <ToggleButton value="scratch">Start from scratch</ToggleButton>
                        </ToggleButtonGroup>
                    )}
                    {!template && creationMode === 'copy' && (
                        <AppDateField label="Copy this day" value={sourceDate} onChange={setSourceDate} />
                    )}
                    {showEditor && (
                        <DayTemplateEditor
                            events={eventDrafts}
                            tasks={taskDrafts}
                            onAddEvent={() => setEventDrafts(current => [...current, defaultEventDraft()])}
                            onUpdateEvent={updateEvent}
                            onRemoveEvent={index => setEventDrafts(current => current.filter((_, eventIndex) => eventIndex !== index))}
                            onAddTask={() => setTaskDrafts(current => [...current, defaultTaskDraft()])}
                            onUpdateTask={updateTask}
                            onRemoveTask={index => setTaskDrafts(current => current.filter((_, taskIndex) => taskIndex !== index))}
                        />
                    )}
                    {(showEditor || sourceDate) && (
                        <Typography variant="caption" color="text.secondary">
                            {showEditor
                                ? `This template contains ${preview.events.length} event${preview.events.length === 1 ? '' : 's'} and ${preview.tasks.length} task${preview.tasks.length === 1 ? '' : 's'}.`
                                : `${formatTemplateDate(sourceDate)} contains ${preview.events.length} event${preview.events.length === 1 ? '' : 's'} and ${preview.tasks.length} task${preview.tasks.length === 1 ? '' : 's'}.`}
                        </Typography>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={close} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={() => void save()} disabled={saving}>
                    {saving ? 'Saving…' : template ? 'Save changes' : 'Save template'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
