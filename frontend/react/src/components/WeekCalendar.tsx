import React, { useMemo } from 'react';
import { Box, Chip, Paper, Tooltip, Typography } from '@mui/material';
import { HoverCardBox } from './box/HoverCardBox';
import { Task } from '../types/Task';

type TaskCalendarProps = {
    tasks: Task[];
};

export function WeekCalendar({ tasks }: TaskCalendarProps) {
    // Get current week (Sunday to Saturday)
    const weekDays = useMemo(() => {
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
        const week = [];

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - currentDay + i);
            week.push(date);
        }
        return week;
    }, []);

    // Group tasks by date
    const tasksByDate = useMemo(() => {
        const grouped: { [key: string]: Task[] } = {};

        tasks.forEach(task => {
            if (task.scheduledPerformDateTime) {
                const taskDate = new Date(task.scheduledPerformDateTime);
                const dateKey = taskDate.toISOString().split('T')[0];

                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(task);
            }
        });

        return grouped;
    }, [tasks]);

    const getDayName = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const getDateNumber = (date: Date) => {
        return date.getDate();
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const getTasksForDate = (date: Date): Task[] => {
        const dateKey = date.toISOString().split('T')[0];
        return tasksByDate[dateKey] || [];
    };

    return (
        <HoverCardBox maximumHeight="250px">
            <Typography variant="h6" sx={{ mb: 2 }}>
                This Week
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 1,
                }}
            >
                {weekDays.map((day, index) => {
                    const dayTasks = getTasksForDate(day);
                    const todayHighlight = isToday(day);

                    return (
                        <Paper
                            key={index}
                            elevation={todayHighlight ? 3 : 1}
                            sx={{
                                p: 1,
                                backgroundColor: todayHighlight
                                    ? 'rgba(25, 118, 210, 0.1)'
                                    : 'background.paper',
                                border: todayHighlight ? 2 : 1,
                                borderColor: todayHighlight ? 'primary.main' : 'divider',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '140px',
                                maxHeight: '240px', // prevent box from growing infinitely
                                overflow: 'hidden', // keep everything contained
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: 4,
                                },
                            }}
                        >
                            {/* Day Header */}
                            <Box
                                sx={{
                                    textAlign: 'center',
                                    mb: 1,
                                    pb: 1,
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        fontWeight: 600,
                                        display: 'block',
                                    }}
                                >
                                    {getDayName(day)}
                                </Typography>
                                <Typography
                                    variant="h6"
                                    color={todayHighlight ? 'primary.main' : 'text.primary'}
                                    sx={{ fontWeight: todayHighlight ? 700 : 500 }}
                                >
                                    {getDateNumber(day)}
                                </Typography>
                            </Box>

                            {/* Tasks */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.5,
                                    flex: 1,
                                    flexWrap: 'wrap', // allow chips to wrap
                                    overflowY: 'auto', // enable vertical scrolling if needed
                                    overflowX: 'hidden',
                                    '&::-webkit-scrollbar': {
                                        width: '4px',
                                    },
                                    '&::-webkit-scrollbar-thumb': {
                                        backgroundColor: 'rgba(0,0,0,0.2)',
                                        borderRadius: '2px',
                                    },
                                }}
                            >
                                {dayTasks.length === 0 ? (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            fontStyle: 'italic',
                                            textAlign: 'center',
                                            mt: 1,
                                        }}
                                    >
                                        Free
                                    </Typography>
                                ) : (
                                    <>
                                        {dayTasks.slice(0, 3).map((task) => (
                                            <Tooltip key={task.taskId} title={task.name} arrow>
                                                <Chip
                                                    label={
                                                        task.name.length > 8
                                                            ? task.name.substring(0, 8) + '...'
                                                            : task.name
                                                    }
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: task.importance > 7
                                                            ? '#ef4444'  // Red for high (8-10)
                                                            : task.importance > 4
                                                                ? '#eab308'  // Yellow for medium (5-7)
                                                                : '#1976d2', // Blue for low (0-4)
                                                        color: '#fff',
                                                        textDecoration: task.completed
                                                            ? 'line-through'
                                                            : 'none',
                                                        opacity: task.completed ? 0.6 : 1,
                                                        fontSize: '0.65rem',
                                                        height: '22px',
                                                        width: '100%',
                                                        justifyContent: 'center',
                                                    }}
                                                />
                                            </Tooltip>
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <Chip
                                                label={`+${dayTasks.length - 3} more`}
                                                size="small"
                                                sx={{
                                                    backgroundColor: 'action.selected',
                                                    fontSize: '0.65rem',
                                                    height: '22px',
                                                    width: '100%',
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
        </HoverCardBox>
    );
}