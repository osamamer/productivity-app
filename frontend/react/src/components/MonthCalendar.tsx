import { Box, Tooltip } from "@mui/material";
import { HoverCardBox } from "./box/HoverCardBox.tsx";
import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import React, { useMemo } from "react";
import { Task } from "../types/Task.tsx";
import { useTheme } from "@mui/material";
import { EventMountArg } from '@fullcalendar/core';

type MonthCalenderProps = {
    tasks: Task[],
}

export function MonthCalendar({ tasks }: MonthCalenderProps) {
    const theme = useTheme();

    const calendarEvents = useMemo(() => {
        return tasks
            .filter(task => task.scheduledPerformDateTime)
            .map(task => ({
                id: task.taskId,
                title: task.name || 'Untitled Task',
                date: new Date(task.scheduledPerformDateTime!).toISOString().split('T')[0],
                backgroundColor: task.completed ? '#4caf50' :
                    task.importance > 7
                        ? '#ef4444'  // Red for high (8-10)
                        : task.importance > 4
                            ? '#eab308'  // Yellow for medium (5-7)
                            : '#1976d2', // Blue for low (0-4)
                borderColor: 'transparent',
                extendedProps: {
                    fullDescription: task.name || 'Untitled Task',
                    completed: task.completed,
                }
            }));
    }, [tasks, theme]);

    // Add tooltip on event mount
    const handleEventDidMount = (info: EventMountArg) => {
        const fullDescription = info.event.extendedProps.fullDescription;

        // Add native HTML title attribute for tooltip
        info.el.setAttribute('title', fullDescription);

        // Or use a more sophisticated approach with custom styling
        info.el.style.cursor = 'pointer';
    };

    return (
        <HoverCardBox height="100%" hover={false}>
            <Box
                sx={{
                    height: '100%',
                    // ... all your existing styles
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
                        '&:hover': {
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.05)',
                            transform: 'scale(1.01)',
                        },
                    },
                    '& .fc-day-today': {
                        background: `${theme.palette.primary.main}20 !important`,
                        borderRadius: '8px',
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
                        textOverflow: 'ellipsis', // Add ellipsis for truncated text
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
                    plugins={[dayGridPlugin]}
                    initialView="dayGridMonth"
                    height="100%"
                    events={calendarEvents}
                    eventDidMount={handleEventDidMount}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: ''
                    }}
                />
            </Box>
        </HoverCardBox>
    );
}