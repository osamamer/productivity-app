import { Box, Dialog, DialogContent, Tabs, Tab, Typography } from "@mui/material";
import { HoverCardBox } from "./box/HoverCardBox.tsx";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import React, { useMemo, useState, useCallback } from "react";
import { Task } from "../types/Task.tsx";
import { useTheme } from "@mui/material";
import { EventMountArg } from '@fullcalendar/core';
import { TaskToCreate } from "../types/TaskToCreate.tsx";
import { SmartTaskInput } from "./input/SmartTaskInput.tsx";
import { StatDefinition } from "../types/Stats.ts";
import { DateStatCheckIn } from "./stats/DateStatCheckIn.tsx";
import { format, isAfter, startOfDay } from "date-fns";

type MonthCalenderProps = {
    tasks: Task[],
    onCreateTask: (task: TaskToCreate) => void,
    statDefinitions?: StatDefinition[],
}

export function MonthCalendar({ tasks, onCreateTask, statDefinitions }: MonthCalenderProps) {
    const theme = useTheme();
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(0);
    const hasStats = statDefinitions && statDefinitions.length > 0;
    const isFutureDate = editingDate
        ? isAfter(startOfDay(new Date(editingDate + 'T12:00:00')), startOfDay(new Date()))
        : true;

    const calendarEvents = useMemo(() => {
        return tasks
            .filter(task => task.scheduledPerformDateTime)
            .map(task => ({
                id: task.taskId,
                title: task.name || 'Untitled Task',
                date: new Date(task.scheduledPerformDateTime!).toISOString().split('T')[0],
                backgroundColor: task.completed ? '#4caf50' :
                    task.importance > 7
                        ? '#ef4444'
                        : task.importance > 4
                            ? '#eab308'
                            : '#1976d2',
                borderColor: 'transparent',
                extendedProps: {
                    fullDescription: task.name || 'Untitled Task',
                    completed: task.completed,
                }
            }));
    }, [tasks]);

    const handleEventDidMount = useCallback((info: EventMountArg) => {
        const fullDescription = info.event.extendedProps.fullDescription;
        info.el.setAttribute('title', fullDescription);
        info.el.style.cursor = 'pointer';
    }, []);

    const handleDateClick = useCallback((arg: DateClickArg) => {
        setEditingDate(arg.dateStr);
        setActiveTab(0);
    }, []);

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
                            border: 'none',
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
                    }}
                >
                    <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        height="100%"
                        events={calendarEvents}
                        eventDidMount={handleEventDidMount}
                        dateClick={handleDateClick}
                        dayMaxEvents={4}
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: ''
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
        </>
    );
}
