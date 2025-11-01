import {Task} from "../../types/Task.tsx";
import React from "react";
import {Box, Typography} from "@mui/material";
import {HoverCardBox} from "./HoverCardBox";
import {TaskToCreate} from "../../types/TaskToCreate";
import {SmartTaskInput} from "../input/SmartTaskInput";
import {TaskAccordion} from "../TaskAccordion";

type props = {
    pastTasks: Task[],
    todayTasks: Task[],
    futureTasks: Task[],
    type: string,
    toggleTaskCompletion: (taskId: string) => void,
    onDivClick: (task: Task) => void,
    handleButtonClick: (dialogType: string) => void
    onSubmit: (taskToCreate: TaskToCreate) => void,
};

export function TaskBox(props: props) {
    const todayTasksExist = Array.isArray(props.todayTasks) && props.todayTasks.length > 0;
    const futureTasksExist = Array.isArray(props.futureTasks) && props.futureTasks.length > 0;
    const pastTasksExist = Array.isArray(props.pastTasks) && props.pastTasks.length > 0;
    const tasksExist = todayTasksExist || futureTasksExist || pastTasksExist;

    return (
        <HoverCardBox>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 3,
                gap: 2
            }}>
                <Typography
                    color="text.primary"
                    variant="h5"
                    component="div"
                >
                    What's on your mind?
                </Typography>
                <Box sx={{ width: '50%' }}>
                    <SmartTaskInput onSubmit={props.onSubmit} />
                </Box>
            </Box>

            <TaskAccordion
                title="Today"
                tasks={props.todayTasks}
                defaultExpanded={true}
                toggleTaskCompletion={props.toggleTaskCompletion}
                onTaskClick={props.onDivClick}
            />

            <TaskAccordion
                title="Leftovers"
                tasks={props.pastTasks}
                defaultExpanded={false}
                toggleTaskCompletion={props.toggleTaskCompletion}
                onTaskClick={props.onDivClick}
            />

            <TaskAccordion
                title="Coming up"
                tasks={props.futureTasks}
                defaultExpanded={false}
                toggleTaskCompletion={props.toggleTaskCompletion}
                onTaskClick={props.onDivClick}
            />

            {!tasksExist && (
                <Typography
                    variant="h6"
                    sx={{
                        textAlign: 'center',
                        color: 'text.secondary',
                        fontStyle: 'italic',
                        py: 4
                    }}
                >
                    Nothing to do. Enjoy!
                </Typography>
            )}
        </HoverCardBox>
    );
}