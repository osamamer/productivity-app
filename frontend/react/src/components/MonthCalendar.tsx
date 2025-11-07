import {HoverCardBox} from "./box/HoverCardBox.tsx";
import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import React, {useMemo} from "react";
import {Task} from "../types/Task.tsx";

type MonthCalenderProps = {
    tasks: Task [],
}
export function MonthCalendar({ tasks } : MonthCalenderProps) {
    const tasksByDate = useMemo(() => {
        const grouped: { [key: string] : Task[] } = {};
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

    const calendarEvents = useMemo(() => {
        return tasks
            .filter(task => task.scheduledPerformDateTime)
            .map(task => ({
                id: task.taskId,
                title: task.name || 'Untitled Task',
                date: new Date(task.scheduledPerformDateTime!).toISOString().split('T')[0],
                // Color based on completion/priority
                backgroundColor: task.completed ? '#4caf50' :
                    task.importance > 7
                        ? '#ef4444'  // Red for high (8-10)
                        : task.importance > 4
                            ? '#eab308'  // Yellow for medium (5-7)
                            : '#1976d2', // Blue for low (0-4)
                borderColor: 'transparent',
                extendedProps: {
                    completed: task.completed,
                }
            }));
    }, [tasks]);


    return (
        <HoverCardBox height="100%" hover={false}>
            <FullCalendar
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                height="80%" // Fill the card
                events={calendarEvents}
            />
        </HoverCardBox>
    )
}