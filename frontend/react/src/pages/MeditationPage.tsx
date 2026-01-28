import { Box } from "@mui/material";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {MonthCalendar} from "../components/MonthCalendar.tsx";
import {useTaskManager} from "../hooks/useTaskManager.ts";
import {useEffect} from "react";
import {useGlobalTasks} from "../contexts/TaskContext.tsx";
import {taskService} from "../services/api";
import {TaskToCreate} from "../types/TaskToCreate.tsx";
import PomodoroTimer from "../components/timer/PomodoroTimer.tsx";
import {Task} from "../types/Task.tsx";
import MeditationTimer from "../components/timer/MeditationTimer.tsx";

export function MeditationPage(props: {task: Task}) {


    return (
        <PageWrapper>
            <Box sx={{
                height: '100%',
                width: '100%',
            }}>
                <MeditationTimer/>

            </Box>
        </PageWrapper>
    );
}