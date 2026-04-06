import { Box } from "@mui/material";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {MonthCalendar} from "../components/MonthCalendar.tsx";
import {useTaskManager} from "../hooks/useTaskManager.ts";
import {useEffect, useState} from "react";
import {taskService} from "../services/api";
import {TaskToCreate} from "../types/TaskToCreate.tsx";
import {StatDefinition} from "../types/Stats.ts";
import {statService} from "../services/api/statService.ts";

export function CalendarPage() {
    const {
        allTasks,
        fetchAllTasks,
        addTaskToState,
    } = useTaskManager();

    const [statDefinitions, setStatDefinitions] = useState<StatDefinition[]>([]);

    useEffect(() => {
        fetchAllTasks();
        statService.getDefinitions()
            .then(setStatDefinitions)
            .catch(e => console.error('Failed to load stat definitions:', e));
    }, []);

    const handleCreateTask = async (taskToCreate: TaskToCreate) => {
        try {
            const createdTask = await taskService.createTask(taskToCreate);
            addTaskToState(createdTask);
        } catch (err) {
            console.error('Error creating task:', err);
            await fetchAllTasks();
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
                    onCreateTask={handleCreateTask}
                    statDefinitions={statDefinitions}
                />
            </Box>
        </PageWrapper>
    );
}