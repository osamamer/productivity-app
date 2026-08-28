import { Box } from "@mui/material";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {MonthCalendar} from "../components/MonthCalendar.tsx";
import {useGlobalTasks} from "../contexts/TaskContext.tsx";
import {useEffect, useState} from "react";
import {eventService, taskService} from "../services/api";
import {TaskToCreate} from "../types/TaskToCreate.tsx";
import {StatDefinition} from "../types/Stats.ts";
import {statService} from "../services/api/statService.ts";
import {Task} from "../types/Task.tsx";
import {CalendarEvent, CalendarEventInput} from "../types/CalendarEvent.ts";

export function CalendarPage() {
    const {
        allTasks,
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        addTaskToState,
        updateTaskInState,
    } = useGlobalTasks();

    const [statDefinitions, setStatDefinitions] = useState<StatDefinition[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        statService.getDefinitions()
            .then(setStatDefinitions)
            .catch(e => console.error('Failed to load stat definitions:', e));
    }, []);

    useEffect(() => {
        eventService.getEvents()
            .then(setEvents)
            .catch(e => console.error('Failed to load calendar events:', e));
    }, []);

    const handleCreateEvent = async (input: CalendarEventInput) => {
        const created = await eventService.createEvent(input);
        setEvents(current => [...current, created]);
    };

    const handleUpdateEvent = async (eventId: string, input: CalendarEventInput) => {
        const updated = await eventService.updateEvent(eventId, input);
        setEvents(current => current.map(event => event.id === eventId ? updated : event));
    };

    const handleDeleteEvent = async (eventId: string) => {
        await eventService.deleteEvent(eventId);
        setEvents(current => current.filter(event => event.id !== eventId));
    };

    const handleCreateTask = async (taskToCreate: TaskToCreate) => {
        try {
            const createdTask = await taskService.createTask(taskToCreate);
            addTaskToState(createdTask);
        } catch (err) {
            console.error('Error creating task:', err);
            await fetchAllTasks();
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
        const originalTask = allTasks.find(task => task.taskId === taskId);
        if (!originalTask) return;

        updateTaskInState(taskId, updates);

        try {
            await taskService.updateTask(taskId, updates);
            await Promise.all([
                fetchAllTasks(),
                fetchTodayTasks(),
                fetchFutureTasks(),
                fetchPastTasks(),
            ]);
        } catch (err) {
            console.error('Error updating task from calendar:', err);
            updateTaskInState(taskId, originalTask);
            throw err;
        }
    };

    return (
        <PageWrapper>
            <Box sx={{
                height: '100%',
                width: '100%',
            }}>
                <MonthCalendar
                    tasks={allTasks}
                    events={events}
                    onCreateTask={handleCreateTask}
                    onUpdateTask={handleUpdateTask}
                    onCreateEvent={handleCreateEvent}
                    onUpdateEvent={handleUpdateEvent}
                    onDeleteEvent={handleDeleteEvent}
                    statDefinitions={statDefinitions}
                />
            </Box>
        </PageWrapper>
    );
}
