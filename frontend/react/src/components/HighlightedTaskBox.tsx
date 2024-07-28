import React from "react";
import {Task} from "../interfaces/Task.tsx";
import {DialogContent, styled} from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import {PomodoroDialog} from "./PomodoroDialog.tsx";
import {OvalButton} from "../App.tsx";
// const OvalButton = styled(Button)({
//     borderRadius: '50px', // Adjust the value to get the oval shape you desire
//     padding: '10px 20px', // Adjust the padding for the desired size
//     margin: 10
// });
type props = {
    task: Task
    handleOpen: (string) => void;
};

export function HighlightedTaskBox(props: props) {

    return (
        <div className="box container" id="highlighted-task-box">
            <div id="highlighted-task-header" className="highlighted-task-text">{props.task.name}</div>
            <div className="highlighted-task-text">{props.task.description}</div>
            <OvalButton variant="contained" color="primary" onClick={() => {
                props.handleOpen('pomodoroDialog')
            }}>
                POMODORO SESSION
            </OvalButton>
            <OvalButton variant="contained" color="secondary" >
                START WORK
            </OvalButton>
            <OvalButton variant="contained" color="primary">
            </OvalButton>
        </div>
    );
}