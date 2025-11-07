import { Box } from "@mui/material";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {MonthCalendar} from "../components/MonthCalendar.tsx";
import {useTaskManager} from "../hooks/useTaskManager.ts";
import {useEffect} from "react";
import {useGlobalTasks} from "../contexts/TaskContext.tsx";
import {taskService} from "../services/api";
import {TaskToCreate} from "../types/TaskToCreate.tsx";

export function CalendarPage() {
    const {
        allTasks,
        fetchAllTasks,
        addTaskToState,
    } = useTaskManager();

    useEffect(() => {
        fetchAllTasks();
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
                />
            </Box>
        </PageWrapper>
    );
}