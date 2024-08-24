import {Task} from "../interfaces/Task.tsx";
import React from "react";
import {TaskDiv} from "./TaskDiv.tsx";
import {OvalButton} from "../pages/HomePage.tsx";
import Button from "@mui/material/Button";
import {Box, Card, List, Typography} from "@mui/material";

type props = {
    tasks: Task[], type: string, toggleTaskCompletion: (taskId: string) => void,
    onDivClick: (task: Task) => void, handleButtonClick: (dialogType: string) => void
};

export function TaskBox(props: props) {
    const tasksLength = props.tasks.length;
    const tasksEmpty = tasksLength === 0;
    const isTodayBox = props.type === "Today";
    return (
        <Card className="box-shadow box" sx={{
            display: 'flex', gap: 1, px: 4, py: 2, minHeight: 200, direction: 'column',
            flex: isTodayBox ? '0 0 1' : '0 0 0 ',
            '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 5,
        }}>
            <Typography variant="h4">{`${props.type}'s tasks`}</Typography>
            <Button sx={{width: 1 / 2, position: 'sticky'}} variant="outlined" color="primary" onClick={() => {
                props.handleButtonClick('createTaskDialog')
            }}>New task</Button>
            {!tasksEmpty && <List>
                {props.tasks.map((task: Task) => (
                    <TaskDiv task={task} toggleTaskCompletion={props.toggleTaskCompletion} onClick={props.onDivClick}/>
                ))}
            </List>}
            {tasksEmpty && <Typography variant="h5">No tasks.</Typography>}


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