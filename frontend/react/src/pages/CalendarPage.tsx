import { Box } from "@mui/material";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {MonthCalendar} from "../components/MonthCalendar.tsx";
import {useTaskManager} from "../hooks/useTaskManager.ts";
import {useEffect} from "react";
import {useGlobalTasks} from "../contexts/TaskContext.tsx";

export function CalendarPage() {
    const { allTasks } = useGlobalTasks();

    return (
        <PageWrapper>
            <Box sx={{
                height: '100%', // Fill parent height
                width: '100%',  // Fill parent width
            }}>
                <MonthCalendar tasks={allTasks}/>
            </Box>
        </PageWrapper>
    );
}