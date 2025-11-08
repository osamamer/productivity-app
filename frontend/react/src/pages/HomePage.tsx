import React, {useEffect, useState} from 'react'
import '../App.css'
import {TodayBox} from "../components/box/TodayBox.tsx";
import {TaskBox} from "../components/box/TaskBox.tsx";
import {HighlightedTaskBox} from "../components/box/HighlightedTaskBox.tsx";
import {HighestPriorityTaskBox} from "../components/box/HighestPriorityTaskBox.tsx";
import {TaskToCreate} from "../types/TaskToCreate.tsx";
import {Box} from "@mui/material";
import {dayService, taskService} from "../services/api";
import {useAppTheme} from "../contexts/ThemeContext";
import {WeekCalendar} from "../components/WeekCalendar.tsx";
import {PageWrapper} from "../components/PageWrapper.tsx";
import {useGlobalTasks} from "../contexts/TaskContext.tsx";

export function HomePage() {
    const theme = useAppTheme();
    const [dialogOpen, setDialogOpen] =
        useState<{ [key: string]: boolean }>({
            dayDialog: false,
            pomodoroDialog: false,
            createTaskDialog: false,
        });

    const {
        allTasks,
        todayTasks,
        futureTasks,
        pastTasks,
        highlightedTask,
        loading,
        error,
        setHighlightedTask,
        fetchAllTasks,
        fetchTodayTasks,
        fetchFutureTasks,
        fetchPastTasks,
        addTaskToState,
        updateTaskInState,
        removeTaskFromState,
    } = useGlobalTasks();

    useEffect(() => {
        const fetchData = async () => {
            await Promise.all([
                fetchAllTasks(),
                fetchTodayTasks(),
                fetchFutureTasks(),
                fetchPastTasks(),
            ]);
        };
        fetchData();
    }, []);


     async function createTask(task: TaskToCreate) {
        try {
            const createdTask = await taskService.createTask(task);
            addTaskToState(createdTask);
            setHighlightedTask(createdTask);
        } catch (err) {
            console.error('Error creating task:', err);
            // Fallback: refetch if create doesn't return task
            await Promise.all([
                fetchAllTasks(),
                fetchTodayTasks(),
                fetchFutureTasks(),
                fetchPastTasks(),
            ]);
        }
    }

    async function toggleTaskCompletion(taskId: string) {
        // Optimistic update
        const task = allTasks.find(t => t.taskId === taskId);
        if (task) {
            updateTaskInState(taskId, { completed: !task.completed });
        }

        try {
            await taskService.toggleTaskCompletion(taskId);
        } catch (err) {
            console.error('Error toggling task:', err);
            // Rollback
            if (task) {
                updateTaskInState(taskId, { completed: task.completed });
            }
        }
    }

    async function completeTask(taskId: string) {
        // Optimistic removal
        removeTaskFromState(taskId);

        try {
            await taskService.completeTask(taskId);
        } catch (err) {
            console.error('Error completing task:', err);
            // Refetch on error
            await fetchAllTasks();
        }
    }

    async function changeDescription(description: string, taskId: string) {
        updateTaskInState(taskId, { description: description });

        try {
            await taskService.updateDescription(taskId, description);
        } catch (err) {
            console.error('Error updating description:', err);
            await fetchAllTasks();
        }
    }

    async function startPomodoro(
        taskId: string,
        focusDuration: number,
        shortBreakDuration: number,
        longBreakDuration: number,
        numFocuses: number,
        longBreakCooldown: number
    ) {
        try {
            await taskService.startPomodoro(
                taskId,
                focusDuration,
                shortBreakDuration,
                longBreakDuration,
                numFocuses,
                longBreakCooldown
            );
        } catch (err) {
            console.error('Error starting pomodoro:', err);
        }
    }


    function getCurrentDateFormatted() {
        const date = new Date();
        const year = date.getFullYear();
        const month = `0${date.getMonth() + 1}`.slice(-2);
        const day = `0${date.getDate()}`.slice(-2);
        return `${year}-${month}-${day}`;
    }


    const handleOpen = (dialogType: string) => {
        setDialogOpen((prev) =>
            ({...prev, [dialogType]: true}));
    };

// Handles closing for all modals
    const handleClose = (dialogType: string) => {
        setDialogOpen((prev) =>
            ({...prev, [dialogType]: false}));
    };



    return (
        <>
            <PageWrapper>
                <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    height: '100%',
                }}>

                    <Box className="left-section"
                         // sx={{width: '25%'}}
                         sx={{
                             display: 'flex',
                             flexDirection: 'column',
                             flex: { xs: '1 1 100%', md: '1 1 45%', lg: '1 1 18%' },
                             minWidth: 0,
                             gap: 4,
                         }}
                    >
                        <TodayBox handleOpenDialog={handleOpen}/>
                        <HighestPriorityTaskBox tasks={allTasks}/>


                        {/*{allTasks.length > 0 && ( <PomodoroTimer tasks={allTasks}/>)}*/}
                    </Box>


                    <Box className="center-section"
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            flex: { xs: '1 1 100%', md: '1 1 45%', lg: '1 1 25%' },
                            minWidth: 0
                        }}
                        >
                        <TaskBox pastTasks={pastTasks}
                                 todayTasks={todayTasks}
                                 futureTasks={futureTasks} type={"Next week"}
                                 toggleTaskCompletion={toggleTaskCompletion}
                                 onDivClick={setHighlightedTask} handleButtonClick={handleOpen}
                                 onSubmit={createTask}   />
                    </Box>



                    <Box className="right-section"
                         // sx={{width: '40%'}}
                         sx={{
                             display: 'flex',
                             flexDirection: 'column',
                             gap: 4,
                             flex: { xs: '1 1 100%', md: '1 1 100%', lg: '1 1 25%'  },
                             minWidth: 0
                         }}
                    >
                        {highlightedTask && (
                            <HighlightedTaskBox
                                key={highlightedTask.taskId}
                                tasks={allTasks}
                                task={highlightedTask}
                                handleOpenDialog={handleOpen}
                                toggleTaskCompletion={toggleTaskCompletion}
                                handleChangeDescription={changeDescription}
                            />
                        )}
                        <WeekCalendar tasks={allTasks} />


                    </Box>
                </Box>
            </PageWrapper>

        </>
    )
}

export default HomePage
