import {Task} from "../interfaces/Task.tsx";
import React from "react";
import {TaskDiv} from "./TaskDiv.tsx";
import {OvalButton} from "../pages/HomePage.tsx";
import Button from "@mui/material/Button";
import {Box, Card, List, Typography} from "@mui/material";

type props = {
    allTasks: Task[], todayTasks: Task[], type: string, toggleTaskCompletion: (taskId: string) => void,
    onDivClick: (task: Task) => void, handleButtonClick: (dialogType: string) => void
};

export function TaskBox(props: props) {
    const noTasks = props.allTasks.length === 0;
    const noTodayTasks = props.allTasks.length === 0;
    const isTodayBox = props.type === "Today";
    return (
        <Card className="box-shadow box" sx={{
            display: 'flex', gap: 1, px: 2, py: 2, minHeight: 200, direction: 'column',
            flex: isTodayBox ? '0 0 1' : '0 0 1 ',
            '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 5,
            maxHeight: '80%',
        }}>
            {/*<Typography variant="h4">{`${props.type}'s tasks`}</Typography>*/}
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1}}>
                <Typography variant="h4" sx={{textAlign: 'left'}}>Tasks</Typography>
                <Button sx={{width: 1 / 2, position: 'sticky', alignSelf: 'flex-end'}} variant="outlined"
                        color="primary" onClick={() => {
                    props.handleButtonClick('createTaskDialog')
                }}>New task</Button>
            </Box>
            {!noTodayTasks
                && <List>
                    {props.todayTasks.map((task: Task) => (
                        <TaskDiv key={task.taskId} task={task} toggleTaskCompletion={props.toggleTaskCompletion}
                                 onClick={props.onDivClick}/>
                    ))}
                </List>}
            {!noTasks && (
                <>
                    <Typography variant="h5" sx={{textAlign: 'left', mt: 1}}>
                        Leftovers
                    </Typography>
                    <List>
                        {props.allTasks.map((task: Task) => (
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
            {noTasks && <Typography variant="h6">Nothing to do. Enjoy!</Typography>}


        </Card>
        // <div id={`${props.type}-tasks-container`} className="box box-shadow container">
        //     <h1 className="box-header">{`${props.type}'s tasks`}</h1>
        //     <Button sx={{width: 1/2}} variant="outlined" color="primary" onClick={() => {
        //         props.handleButtonClick('createTaskDialog')
        //     }}>New task</Button>
        //     {!tasksEmpty && <div className="tasks-div" id="today-tasks-div">
        //         {props.tasks.map((task: Task) => (
        //             <TaskDiv task={task} toggleTaskCompletion={props.toggleTaskCompletion} onClick={props.onDivClick}/>
        //         ))}
        // //     </div>}
        // </div>

    );
}