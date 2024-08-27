import React, {useEffect, useState} from 'react'
import '../App.css'
import {Task} from "../interfaces/Task.tsx";
import {DayEntity} from "../interfaces/DayEntity.tsx";
import {TodayBox} from "../components/TodayBox.tsx";
import {TaskBox} from "../components/TaskBox.tsx";
import {CreateTaskDialog} from "../components/CreateTaskDialog.tsx";
import {HighlightedTaskBox} from "../components/HighlightedTaskBox.tsx";
import {HighestPriorityTaskBox} from "../components/HighestPriorityTaskBox.tsx";
import {Timer} from "../components/Timer.tsx";
import {Header} from "../components/Header.tsx";
import {DayDialog} from "../components/DayDialog.tsx";
import {SideNav} from "../components/SideNav.tsx";
import {TaskToCreate} from "../interfaces/TaskToCreate.tsx";
import Button from '@mui/material/Button'
import {Box, CssBaseline, styled, useTheme} from "@mui/material";
import {PomodoroDialog} from "../components/PomodoroDialog.tsx";
import {TopBar} from "../components/TopBar.tsx";
import {lightTheme} from "../Theme.tsx";
export const OvalButton = styled(Button)({
    borderRadius: '50px', // Adjust the value to get the oval shape you desire
    padding: '10px 20px', // Adjust the padding for the desired size

});
type props = {darkMode: boolean, darkModeFunction: (darkMode: boolean) => void};
export function HomePage(props: props) {
    const ROOT_URL = "http://localhost:8080";
    const TASK_URL = ROOT_URL.concat("/api/v1/task");
    const DAY_URL = ROOT_URL.concat("/api/v1/day");
    const date = getCurrentDateFormatted();
    const theme = useTheme();
    const [todayTasks, setTodayTasks] = useState<Task[]>([]);
    const [today, setToday] = useState<DayEntity>({} as DayEntity);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [highlightedTask, setHighlightedTask] = useState<Task>({} as Task);
    const [sidenavOpen, setSidenavOpen] = useState(false);
    // const [localDarkMode, setLocalDarkMode] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(75); // Default collapsed width
    const [dialogOpen, setDialogOpen] =
        useState<{ [key: string]: boolean }>({
            dayDialog: false,
            pomodoroDialog: false,
            createTaskDialog: false,
        });

    useEffect(() => {
        fetchTodayTasks();
    }, []);

    useEffect(() => {
        fetchToday();
    }, []);
    useEffect(() => {
        fetchAllTasks();
    }, []);


    function getCurrentDateFormatted() {
        const date = new Date();
        const year = date.getFullYear();
        const month = `0${date.getMonth() + 1}`.slice(-2);
        const day = `0${date.getDate()}`.slice(-2);
        return `${year}-${month}-${day}`;
    }

    // async function fetchTodayUncompletedTasks(): Promise<Task[]> {
    //   const response = await fetch(TASK_URL.concat(`/get-non-completed-tasks/${date}`));
    //     return await response.json();
    // }
    async function fetchAllTasks(): Promise<Task[]> {
        const response = await fetch(TASK_URL);
        const allTasks = await response.json();
        setAllTasks(allTasks);
        setHighlightedTask(allTasks[0]);
        return allTasks;
    }

    async function fetchTodayTasks() {
        try {
            const response = await fetch(TASK_URL.concat(`/get-non-completed-tasks/${date}`));
            const todayTasks: Task[] = await response.json();
            setTodayTasks(todayTasks); // Update state with fetched tasks
            return todayTasks;
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }

    async function fetchToday(): Promise<DayEntity> {
        const response = await fetch(DAY_URL.concat('/get-today'));
        const today = await response.json();
        setToday(today);
        return today;
    }

    async function createTask(task: TaskToCreate) {
        await fetch(TASK_URL.concat("/create-task"), {
            method: "POST",
            body: JSON.stringify({
                taskName: task.name,
                taskDescription: task.description,
                taskPerformTime: task.scheduledPerformDateTime,
                taskTag: task.tag,
                taskImportance: task.importance,
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        });
        await fetchTodayTasks();
        await fetchAllTasks();
    }

    async function toggleTaskCompletion(taskId: string) {
        await fetch(TASK_URL.concat(`/toggle-task-completion/${taskId}`), {
            method: "POST",
        });
        await fetchTodayTasks();
        await fetchAllTasks();
    }

    async function fetchHighestPriorityTask(): Promise<Task> {
        const response =
            await fetch(TASK_URL.concat("/get-newest-uncompleted-highest-priority-task"), {
                method: "GET",
            });
        return response.json();
    }

    function highlightTask(task: Task): void {
        setHighlightedTask(task);
    }

    async function startPomodoro(taskId: string, focusDuration: number, shortBreakDuration: number,
                                 longBreakDuration: number, numFocuses: number,
                                 longBreakCooldown: number): Promise<void> {
        console.log("Attempting to start pomodoro " + taskId + " "
            + focusDuration + " " + shortBreakDuration + " " + longBreakDuration + " " + numFocuses + " " + longBreakCooldown)
        await fetch(TASK_URL.concat("/start-pomodoro"), {
            method: "POST",
            body: JSON.stringify({
                taskId: taskId,
                focusDuration: focusDuration,
                shortBreakDuration: shortBreakDuration,
                longBreakDuration: longBreakDuration,
                numFocuses: numFocuses,
                longBreakCooldown: longBreakCooldown
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        });
    }

    async function setTodayInfo(rating: number, plan: string,
                                summary: string): Promise<void> {
        await fetch(DAY_URL.concat("/set-today-info"), {
            method: "POST",
            body: JSON.stringify({
                dayRating: rating,
                dayPlan: plan,
                daySummary: summary,
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        });
    }

    // Handles opening for all modals
    const handleOpen = (dialogType: string) => {
        setDialogOpen((prev) =>
            ({...prev, [dialogType]: true}));
    };
    // Handles Submission for all modals
    const handleSubmit = (dialogType: string, values: Record<string, any>) => {
        console.log(`Handling ${dialogType} modal submit`)
        console.log(values.focusDuration)
        switch (dialogType) {
            case "pomodoroDialog": {
                startPomodoro(highlightedTask.taskId, values.focusDuration,
                    values.shortBreakDuration, values.longBreakDuration,
                    values.numFocuses, values.longBreakCooldown);
                break;
            }
            case "createTaskDialog": {
                const task: TaskToCreate = {
                    name: values.taskName,
                    description: values.taskDescription,
                    scheduledPerformDateTime: values.taskPerformTime,
                    tag: values.taskTag,
                    importance: values.taskImportance
                }
                createTask(task);
                break;
            }
            case "dayDialog": {
                setTodayInfo(values.dayRating, values.dayPlan,
                    values.daySummary)
                    .then(() => fetchToday()).then((today) => setToday(today));
                break;
            }
        }
    };
// Handles closing for all modals
    const handleClose = (dialogType: string) => {
        setDialogOpen((prev) =>
            ({...prev, [dialogType]: false}));
    };
    // Makes more sense to have them here since they may be used for multiple components

    // const [highestPriorityTask, setHighestPriorityTask] = useState<Task>({} as Task);


    return (
        <>
            <PomodoroDialog open={dialogOpen.pomodoroDialog}
                            handleClose={handleClose}
                            onSubmit={handleSubmit}/>
            <CreateTaskDialog handleClose={handleClose} onSubmit={handleSubmit} open={dialogOpen.createTaskDialog}/>
            <DayDialog open={dialogOpen.dayDialog}
                       handleClose={handleClose}
                       onSubmit={handleSubmit}/>
            <Box sx={{display: 'flex'}}>
                {/*<CssBaseline/>*/}
                <SideNav onSidebarWidthChange={setSidebarWidth} openProp={sidenavOpen} darkMode={props.darkMode}/>
                {/*<Header onSubmit={createTask}/>*/}
                <TopBar onSubmit={createTask} darkMode={props.darkMode} darkModeFunction={props.darkModeFunction}/>
                <Box sx={{
                    // width: 1,
                    maxWidth: '100%',
                    display: 'flex',
                    overflow: 'hidden',
                    justifyContent: 'center',
                    mt: 8, flexGrow: 1, mr: 0,
                    marginLeft: `${sidebarWidth}px`,
                    ...(sidenavOpen && {
                        transition: theme.transitions.create('margin', {
                            easing: theme.transitions.easing.easeOut,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                        marginLeft: 0,
                    }),
                    transition: theme.transitions.create('margin', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                    padding: 3,
                }}>
                    {/*<div className="section left-section">*/}
                    <Box className="section" sx={{width: '25%'}}>
                        {/*<TaskBox tasks={todayTasks} type={"Today"}*/}
                        {/*         toggleTaskCompletion={toggleTaskCompletion}*/}
                        {/*         onDivClick={highlightTask} handleButtonClick={handleOpen}/>*/}
                        <TaskBox allTasks={allTasks} todayTasks={todayTasks} type={"Next week"}
                                 toggleTaskCompletion={toggleTaskCompletion}
                                 onDivClick={highlightTask} handleButtonClick={handleOpen} />
                    </Box>


                    <Box className="section" sx={{width: '40%'}}>
                        <HighestPriorityTaskBox tasks={allTasks}/>
                        <HighlightedTaskBox task={highlightedTask} handleOpenDialog={handleOpen}/>
                        <Timer/>
                    </Box>

                    <Box className="section" sx={{width: '40%'}}>
                        <TodayBox today={today} handleOpenDialog={handleOpen} darkMode={props.darkMode}/>
                    </Box>
                </Box>
            </Box>


        </>
    )
}

export default HomePage
