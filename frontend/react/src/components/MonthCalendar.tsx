import { Box, Popover } from "@mui/material";
import { HoverCardBox } from "./box/HoverCardBox.tsx";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import React, { useMemo, useState } from "react";
import { Task } from "../types/Task.tsx";
import { useTheme } from "@mui/material";
import { EventMountArg } from '@fullcalendar/core';
import { TaskToCreate } from "../types/TaskToCreate.tsx";
import { SmartTaskInput } from "./input/SmartTaskInput.tsx";

type MonthCalenderProps = {
    tasks: Task[],
    onCreateTask: (task: TaskToCreate) => void,
}

export function MonthCalendar({ tasks, onCreateTask }: MonthCalenderProps) {
    const theme = useTheme();
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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

    const handleEventDidMount = (info: EventMountArg) => {
        const fullDescription = info.event.extendedProps.fullDescription;
        info.el.setAttribute('title', fullDescription);
        info.el.style.cursor = 'pointer';
    };

    const handleDateClick = (arg: DateClickArg) => {
        setEditingDate(arg.dateStr);
        setAnchorEl(arg.dayEl);
    };

    const handleTaskSubmit = (taskToCreate: TaskToCreate) => {
        console.log('handleTaskSubmit called with:', taskToCreate); // DEBUG

        // CRITICAL FIX: Always ensure proper datetime format
        let finalDateTime = taskToCreate.scheduledPerformDateTime;

        // If no datetime OR if it's just a date without time, add the time
        if (!finalDateTime || !finalDateTime.includes('T')) {
            finalDateTime = `${editingDate}T12:00:00`;
        }

        const finalTask: TaskToCreate = {
            ...taskToCreate,
            scheduledPerformDateTime: finalDateTime
        };

        console.log('Final task being created:', finalTask); // DEBUG
        onCreateTask(finalTask);
        setEditingDate(null);
        setAnchorEl(null);
    };

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
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.03)'
                                : 'rgba(0, 0, 0, 0.02)',
                            margin: '2px',
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
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: ''
                        }}
                    />
                </Box>
            </HoverCardBox>

            <Popover
                open={Boolean(editingDate)}
                anchorEl={anchorEl}
                onClose={() => {
                    setEditingDate(null);
                    setAnchorEl(null);
                }}
                anchorOrigin={{
                    vertical: 'center',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(30, 30, 30, 0.98)'
                                : 'rgba(250, 250, 250, 0.98)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: theme.shadows[8],
                        }
                    }
                }}
            >
                <Box sx={{ p: 2, minWidth: 300 }}>
                    <SmartTaskInput
                        onSubmit={handleTaskSubmit}
                        initialDate={editingDate || undefined}
                        autoFocus
                    />
                </Box>
            </Popover>
        </>
    );
}