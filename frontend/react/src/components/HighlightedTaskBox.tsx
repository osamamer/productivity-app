import React from "react";
import {Task} from "../interfaces/Task.tsx";
import {Box, Card, DialogContent, styled, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import CheckIcon from '@mui/icons-material/Check';
import AdjustIcon from '@mui/icons-material/Adjust';
import EditableField from "./EditableField.tsx";
import {HoverCardBox} from "./HoverCardBox";

type props = {
    task: Task;
    handleOpenDialog?: (dialogType: string) => void;
    handleCompleteTask: (taskId: string) => void;
    handleChangeDescription: (description: string, taskId: string) => void;
};

export function HighlightedTaskBox(props: props) {
    let importance;
    console.log(props.task)
    if (!(props.task) || props.task.importance <= 3) {
        importance = "low";
    } else if (3 < props.task.importance && props.task.importance <= 7) {
        importance = "medium";

    } else {
        importance = "high";
    }
    let color = importance;

    if (!props.task) {
        return null;
    }

    return (
        <HoverCardBox>
            <Typography variant="h4" sx={{ mb: 0 }}>
                {props.task.name ?? "No task to highlight"}
            </Typography>

            {props.task.description && props.task.description.trim() !== '' && (
                <Typography variant="h5" sx={{ m: 0, p: 0 }}     className="no-margin"
                            dangerouslySetInnerHTML={{ __html: props.task.description }}>
                </Typography>
            )}

            {/*<InputText task={props.task}></InputText>*/}
            <Button
                sx={{m: 1, width: 1 / 2, alignSelf: 'center'}}
                variant="contained"


                onClick={() => {
                    props.handleOpenDialog?.('pomodoroDialog');
                }}
                endIcon={<AdjustIcon/>}
            >
                Focus Session
            </Button>

            <Button
                sx={{m: 1, width: 1 / 2, alignSelf: 'center'}}
                variant="contained"
                // @ts-ignore
                color={color}
                endIcon={<CheckIcon/>}
                onClick={() => {
                    if ("taskId" in props.task) {
                        props.handleCompleteTask(props.task.taskId)
                    }
                }}
            >
                Complete Task
            </Button>
            <EditableField onSubmit={props.handleChangeDescription} initialTargetText={props.task.description}
                           placeholderText={"Describe this task..."} task={props.task}></EditableField>
        </HoverCardBox>

    )
        ;
}
