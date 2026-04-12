import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Tabs, Tab, TextField, Typography } from "@mui/material";
import { HoverCardBox } from "./box/HoverCardBox.tsx";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import React, { useMemo, useState, useCallback } from "react";
import { Task } from "../types/Task.tsx";
import { useTheme } from "@mui/material";
import { EventClickArg, EventMountArg } from '@fullcalendar/core';
import { TaskToCreate } from "../types/TaskToCreate.tsx";
import { SmartTaskInput } from "./input/SmartTaskInput.tsx";
import { StatDefinition } from "../types/Stats.ts";
import { DateStatCheckIn } from "./stats/DateStatCheckIn.tsx";
import { format, isAfter, startOfDay } from "date-fns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";

type MonthCalenderProps = {
    tasks: Task[],
    onCreateTask: (task: TaskToCreate) => void,
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>,
    statDefinitions?: StatDefinition[],
}

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 3, color: '#1976d2' },
    { label: 'Medium', value: 6, color: '#eab308' },
    { label: 'High', value: 9, color: '#ef4444' },
];

function priorityColor(importance: number): string {
    if (importance > 7) return '#ef4444';
    if (importance > 4) return '#eab308';
    return '#1976d2';
}

export function MonthCalendar({ tasks, onCreateTask, onUpdateTask, statDefinitions }: MonthCalenderProps) {
    const theme = useTheme();
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [taskDraft, setTaskDraft] = useState<Partial<Task> | null>(null);
    const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
    const [taskSaving, setTaskSaving] = useState(false);
    const hasStats = statDefinitions && statDefinitions.length > 0;
    const isFutureDate = editingDate
        ? isAfter(startOfDay(new Date(editingDate + 'T12:00:00')), startOfDay(new Date()))
        : true;
    const selectedTask = useMemo(
        () => tasks.find(task => task.taskId === selectedTaskId) ?? null,
        [selectedTaskId, tasks]
    );

    const calendarEvents = useMemo(() => {
        return tasks
            .filter(task => task.scheduledPerformDateTime)
            .map(task => ({
                id: task.taskId,
                title: task.name || 'Untitled Task',
                date: new Date(task.scheduledPerformDateTime!).toISOString().split('T')[0],
                backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'rgba(255, 255, 255, 0.82)',
                borderColor: task.completed ? '#4caf50' : priorityColor(task.importance),
                textColor: theme.palette.text.primary,
                extendedProps: {
                    fullDescription: task.name || 'Untitled Task',
                    completed: task.completed,
                }
            }));
    }, [tasks, theme.palette.mode, theme.palette.text.primary]);

    const handleEventDidMount = useCallback((info: EventMountArg) => {
        const fullDescription = info.event.extendedProps.fullDescription;
        info.el.setAttribute('title', fullDescription);
        info.el.style.cursor = 'pointer';
    }, []);

    const handleDateClick = useCallback((arg: DateClickArg) => {
        setEditingDate(arg.dateStr);
        setActiveTab(0);
    }, []);

    const handleEventClick = useCallback((arg: EventClickArg) => {
        const task = tasks.find(item => item.taskId === arg.event.id);
        if (!task) return;

        setTaskDraft({
            name: task.name,
            description: task.description ?? '',
            importance: task.importance,
            scheduledPerformDateTime: task.scheduledPerformDateTime,
            tag: task.tag ?? '',
            completed: task.completed,
        });
        setTaskSaveError(null);
        setSelectedTaskId(task.taskId);
    }, [tasks]);

    const handleTaskSubmit = useCallback((taskToCreate: TaskToCreate) => {
        let finalDateTime = taskToCreate.scheduledPerformDateTime;

        if (!finalDateTime || !finalDateTime.includes('T')) {
            finalDateTime = `${editingDate}T12:00:00`;
        }

        const finalTask: TaskToCreate = {
            ...taskToCreate,
            scheduledPerformDateTime: finalDateTime
        };

        onCreateTask(finalTask);
        setEditingDate(null);
    }, [editingDate, onCreateTask]);

    const closeTaskDialog = useCallback(() => {
        setSelectedTaskId(null);
        setTaskDraft(null);
        setTaskSaveError(null);
        setTaskSaving(false);
    }, []);

    const handleTaskDateChange = useCallback((newDate: Date | null) => {
        if (!newDate) return;
        const pad = (n: number) => String(n).padStart(2, '0');
        const iso = `${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())}T${pad(newDate.getHours())}:${pad(newDate.getMinutes())}:00`;
        setTaskDraft(prev => prev ? { ...prev, scheduledPerformDateTime: iso } : prev);
    }, []);

    const handleTaskSave = useCallback(async () => {
        if (!selectedTask || !taskDraft) return;

        setTaskSaving(true);
        setTaskSaveError(null);
        try {
            await onUpdateTask(selectedTask.taskId, {
                name: taskDraft.name ?? '',
                description: taskDraft.description ?? '',
                importance: taskDraft.importance ?? selectedTask.importance,
                scheduledPerformDateTime: taskDraft.scheduledPerformDateTime ?? selectedTask.scheduledPerformDateTime,
            });
            closeTaskDialog();
        } catch (error) {
            console.error('Failed to update task from month calendar:', error);
            setTaskSaveError('Failed to save task changes. Please try again.');
        } finally {
            setTaskSaving(false);
        }
    }, [closeTaskDialog, onUpdateTask, selectedTask, taskDraft]);

    return (
        <>
            <HoverCardBox height="100%" hover={false}>
                <Box
                    sx={{
                        height: '100%',
                        '& .fc': {
                            height: '100%',
                            fontFamily: theme.typography.fontFamily,
                        },
                        '& .fc-theme-standard td, & .fc-theme-standard th': {
                            border: 'none',
                        },
                        '& .fc-scrollgrid': {
                            border: 'none',
                        },
                        '& .fc-daygrid-day': {
                            border: 'none',
                            outline: `1px solid ${theme.palette.divider}`,
                            outlineOffset: '-1px',
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.03)'
                                : 'rgba(0, 0, 0, 0.02)',
                            margin: '1px',
                            borderRadius: '0px',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            '&:hover': {
                                background: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                transform: 'scale(1.01)',
                            },
                        },
                        '& .fc-daygrid-day-frame': {
                            minHeight: '80px',
                            display: 'flex',
                            flexDirection: 'column',
                        },
                        '& .fc-day-today': {
                            background: `${theme.palette.primary.main}20 !important`,
                            borderRadius: '0px',
                        },
                        '& .fc-toolbar-title': {
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: theme.palette.text.primary,
                        },
                        '& .fc-col-header-cell': {
                            border: 'none',
                            background: 'transparent',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: '0.75rem',
                            opacity: 0.7,
                            padding: '12px 4px',
                        },
                        '& .fc-daygrid-event': {
                            borderStyle: 'solid',
                            borderWidth: '1px',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            margin: '2px',
                            boxShadow: theme.shadows[2],
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            '&:hover': {
                                boxShadow: theme.shadows[4],
                                transform: 'translateY(-1px)',
                            },
                        },
                        '& .fc-button': {
                            border: 'none !important',
                            background: `${theme.palette.primary.main}30 !important`,
                            borderRadius: '8px !important',
                            color: `${theme.palette.text.primary} !important`,
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                                background: `${theme.palette.primary.main}50 !important`,
                            },
                            '&.fc-button-active': {
                                background: `${theme.palette.primary.main} !important`,
                            },
                        },
                        '& .fc-prev-button, & .fc-next-button': {
                            background: 'transparent !important',
                            border: 'none !important',
                            boxShadow: 'none !important',
                            color: `${theme.palette.text.secondary} !important`,
                            padding: '0.3rem !important',
                            minWidth: 'auto !important',
                        },
                        '& .fc-prev-button:hover, & .fc-next-button:hover': {
                            background: 'transparent !important',
                            color: `${theme.palette.text.primary} !important`,
                        },
                        '& .fc-prev-button .fc-icon, & .fc-next-button .fc-icon': {
                            fontSize: '1.2rem',
                            fontWeight: 700,
                        },
                        '& .fc-popover': {
                            border: `1px solid ${theme.palette.divider}`,
                            backgroundColor: `${theme.palette.background.default} !important`,
                            color: theme.palette.text.primary,
                            boxShadow: theme.shadows[8],
                            borderRadius: '14px',
                            overflow: 'hidden',
                        },
                        '& .fc-popover-header': {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.03)',
                            color: theme.palette.text.primary,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            padding: '10px 12px',
                        },
                        '& .fc-popover-body': {
                            backgroundColor: `${theme.palette.background.default} !important`,
                            padding: '6px',
                        },
                        '& .fc-more-popover .fc-daygrid-event-harness': {
                            marginBottom: '4px',
                        },
                        '& .fc-popover-close': {
                            color: `${theme.palette.text.secondary} !important`,
                        },
                    }}
                >
                    <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        height="100%"
                        events={calendarEvents}
                        eventDidMount={handleEventDidMount}
                        eventClick={handleEventClick}
                        dateClick={handleDateClick}
                        dayMaxEvents={4}
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: ''
                        }}
                        buttonText={{
                            today: 'Today',
                        }}
                    />
                </Box>
            </HoverCardBox>

            <Dialog
                open={Boolean(editingDate)}
                onClose={() => {
                    setEditingDate(null);
                    setActiveTab(0);
                }}
                fullWidth
                maxWidth="xs"
                scroll="paper"
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(30, 30, 30, 0.98)'
                                : 'rgba(250, 250, 250, 0.98)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: theme.shadows[8],
                            width: '100%',
                            maxHeight: '80vh',
                        },
                    },
                }}
            >
                <Box sx={{ pt: 2 }}>
                    {editingDate && (
                        <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
                            {format(new Date(editingDate + 'T12:00:00'), 'MMMM d, yyyy')}
                        </Typography>
                    )}
                    {hasStats && !isFutureDate && (
                        <Tabs
                            value={activeTab}
                            onChange={(_, v) => setActiveTab(v)}
                            sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
                            variant="fullWidth"
                        >
                            <Tab label="Task" />
                            <Tab label="Stats" />
                        </Tabs>
                    )}
                </Box>

                <DialogContent dividers sx={{ p: 0 }}>
                    {activeTab === 0 && (
                        <Box sx={{ p: 2 }}>
                            <SmartTaskInput
                                onSubmit={handleTaskSubmit}
                                initialDate={editingDate || undefined}
                                autoFocus={activeTab === 0}
                            />
                        </Box>
                    )}
                    {activeTab === 1 && hasStats && editingDate && (
                        <DateStatCheckIn
                            date={editingDate}
                            definitions={statDefinitions!}
                            onSaved={() => { setEditingDate(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(selectedTask && taskDraft)}
                onClose={closeTaskDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{selectedTask?.name || 'Task details'}</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    {taskDraft && selectedTask && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                            <TextField
                                label="Name"
                                value={taskDraft.name ?? ''}
                                onChange={(event) => setTaskDraft(prev => prev ? { ...prev, name: event.target.value } : prev)}
                                fullWidth
                            />

                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, textAlign: 'left' }}>
                                    Priority
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {PRIORITY_OPTIONS.map(option => {
                                        const selected = (taskDraft.importance ?? selectedTask.importance) === option.value;
                                        return (
                                            <Chip
                                                key={option.label}
                                                label={option.label}
                                                onClick={() => setTaskDraft(prev => prev ? { ...prev, importance: option.value } : prev)}
                                                sx={{
                                                    borderColor: option.color,
                                                    color: selected ? '#fff' : option.color,
                                                    backgroundColor: selected ? option.color : 'transparent',
                                                    border: `1px solid ${option.color}`,
                                                    cursor: 'pointer',
                                                    fontWeight: selected ? 600 : 400,
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>

                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DateTimePicker
                                    label="Scheduled"
                                    value={taskDraft.scheduledPerformDateTime ? new Date(taskDraft.scheduledPerformDateTime) : null}
                                    onChange={handleTaskDateChange}
                                    ampm={false}
                                    slotProps={{
                                        textField: { size: 'small', fullWidth: true },
                                    }}
                                />
                            </LocalizationProvider>

                            <TextField
                                label="Description"
                                value={taskDraft.description ?? ''}
                                onChange={(event) => setTaskDraft(prev => prev ? { ...prev, description: event.target.value } : prev)}
                                multiline
                                minRows={3}
                                maxRows={8}
                                fullWidth
                            />

                            {selectedTask.tag && (
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
                                    Tag: <strong>{selectedTask.tag}</strong>
                                </Typography>
                            )}

                            {taskSaveError && <Alert severity="error">{taskSaveError}</Alert>}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeTaskDialog}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleTaskSave()}
                        disabled={taskSaving || !(taskDraft?.name ?? '').trim()}
                    >
                        {taskSaving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
