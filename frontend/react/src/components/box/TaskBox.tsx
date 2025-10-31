import {Task} from "../../types/Task.tsx";
import React, {useState} from "react";
import {TaskDiv} from "../TaskDiv.tsx";
import Button from "@mui/material/Button";
import {Accordion, AccordionDetails, AccordionSummary, Box, Card, List, TextField, Typography} from "@mui/material";
import {HoverCardBox} from "./HoverCardBox";
import {TaskToCreate} from "../../types/TaskToCreate";
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

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
    const [newTask, setNewTask] = useState("");


    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (newTask === "") return
        console.log(newTask)
        const taskToCreate: TaskToCreate = {
            name: newTask.valueOf(),
            description: "",
            scheduledPerformDateTime: "",
            tag: "",
            importance: 0};
        props.onSubmit(taskToCreate);
        setNewTask("");
    }


    return (
        <HoverCardBox>
            <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 3}}>
                <Typography
                    color="text.primary"
                    // sx={{ mr: 2}}
                    variant="h5" component="div">
                    What's on your mind?
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ padding: 0, width: '40%' }}>
                    <TextField
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Add task..."
                        variant="standard"
                        fullWidth
                    />
                </Box>
            </Box>

            {/*<Typography variant="h4">{`${props.type}'s tasks`}</Typography>*/}
            {/*<Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, mb: 3}}>*/}
            {/*    <Typography variant="h4" sx={{textAlign: 'left'}}>Tasks</Typography>*/}
            {/*    <Button sx={{width: 1 / 3, position: 'sticky', alignSelf: 'flex-end'}} variant="outlined"*/}
            {/*            color="primary" onClick={() => {*/}
            {/*        props.handleButtonClick('createTaskDialog')*/}
            {/*    }}>New task</Button>*/}
            {/*</Box>*/}
            {todayTasksExist && (
                <Accordion defaultExpanded sx={{borderRadius: 0}}>
                    <AccordionSummary           expandIcon={<ArrowDropDownIcon />}>
                        <Typography variant="h6">Today</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <List>
                            {props.todayTasks.map((task: Task) => (
                                <TaskDiv
                                    key={task.taskId}
                                    task={task}
                                    toggleTaskCompletion={props.toggleTaskCompletion}
                                    onClick={props.onDivClick}
                                />
                            ))}
                        </List>
                    </AccordionDetails>
                </Accordion>
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