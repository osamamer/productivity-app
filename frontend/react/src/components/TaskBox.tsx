import {Task} from "../interfaces/Task.tsx";
import React from "react";
import {TaskDiv} from "./TaskDiv.tsx";
import Button from "@mui/material/Button";
import {Box, Card, List, Typography} from "@mui/material";
import {HoverCardBox} from "./HoverCardBox";

type props = {
    pastTasks: Task[],
    todayTasks: Task[],
    futureTasks: Task[],
    type: string,
    toggleTaskCompletion: (taskId: string) => void,
    onDivClick: (task: Task) => void,
    handleButtonClick: (dialogType: string) => void
};

export function TaskBox(props: props) {
    const todayTasksExist = Array.isArray(props.todayTasks) && props.todayTasks.length > 0;
    const futureTasksExist = Array.isArray(props.futureTasks) && props.futureTasks.length > 0;
    const pastTasksExist = Array.isArray(props.pastTasks) && props.pastTasks.length > 0;
    const tasksExist = todayTasksExist || futureTasksExist || pastTasksExist;


    const isTodayBox = props.type === "Today";
    return (
        <HoverCardBox>
            {/*<Typography variant="h4">{`${props.type}'s tasks`}</Typography>*/}
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1}}>
                <Typography variant="h4" sx={{textAlign: 'left'}}>Tasks</Typography>
                <Button sx={{width: 1 / 2, position: 'sticky', alignSelf: 'flex-end'}} variant="outlined"
                        color="primary" onClick={() => {
                    props.handleButtonClick('createTaskDialog')
                }}>New task</Button>
            </Box>
            {todayTasksExist
                && (
                    <>
                        <Typography variant="h5" sx={{textAlign: 'left', mt: 1}}>
                            For today
                        </Typography>
                        <List>
                            {props.todayTasks.map((task: Task) => (
                                <TaskDiv key={task.taskId} task={task} toggleTaskCompletion={props.toggleTaskCompletion}
                                         onClick={props.onDivClick}/>
                            ))}
                        </List>
                    </>
                )}
            {pastTasksExist && (
                <>
                    <Typography variant="h5" sx={{textAlign: 'left', mt: 1}}>
                        Leftovers
                    </Typography>
                    <List>
                        {props.pastTasks.map((task: Task) => (
                            <TaskDiv
                                key={task.taskId}
                                task={task}
                                toggleTaskCompletion={props.toggleTaskCompletion}
                                onClick={props.onDivClick}
                            />
                        ))}
                    </List>
                </>
            )}
            {futureTasksExist && (
                <>
                    <Typography variant="h5" sx={{textAlign: 'left', mt: 1}}>
                        Coming up
                    </Typography>
                    <List>
                        {props.futureTasks.map((task: Task) => (
                            <TaskDiv
                                key={task.taskId}
                                task={task}
                                toggleTaskCompletion={props.toggleTaskCompletion}
                                onClick={props.onDivClick}
                            />
                        ))}
                    </List>
                </>
            )}
            {!tasksExist && <Typography variant="h6">Nothing to do. Enjoy!</Typography>}


        </HoverCardBox>

    );
}