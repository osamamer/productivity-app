import React, {useEffect, useState} from "react";
import {Task} from "../../interfaces/Task.tsx";
import {Box, Card, DialogContent, styled, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import CheckIcon from '@mui/icons-material/Check';
import AdjustIcon from '@mui/icons-material/Adjust';
import EditableField from "../EditableField.tsx";
import {HoverCardBox} from "./HoverCardBox";
import PomodoroTimer from "../PomodoroTimer";

type props = {
    tasks: Task[];
    task: Task | null;
    handleOpenDialog?: (dialogType: string) => void;
    handleCompleteTask: (taskId: string) => void;
    handleChangeDescription: (description: string, taskId: string) => void;
};

export function HighlightedTaskBox(props: props) {
    const [showPomodoro, setShowPomodoro] = useState(false);
    let importance;
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
    useEffect(() => {

    }, [props.task]);
    return (
        <HoverCardBox
        //     display={(theme) => ({
        //     display: "none",
        //     [theme.breakpoints.up("lg")]: { display: "block" },
        // })}
        >
            <Typography variant="h5" sx={{ mb: 0 }}>
                {props.task.name ?? "No task to highlight"}
            </Typography>
            <EditableField onSubmit={props.handleChangeDescription}
                           description={props.task.description} taskId = {props.task.taskId}></EditableField>
            {/*{props.task.description && props.task.description.trim() !== '' && (*/}
            {/*    <Typography variant="h5" sx={{ m: 0, p: 0 }}     className="no-margin"*/}
            {/*                dangerouslySetInnerHTML={{ __html: props.task.description }}>*/}
            {/*    </Typography>*/}
            {/*)}*/}

            {/*<InputText task={props.task}></InputText>*/}
            <div style={{display: 'flex',
                        alignItems: 'center', justifyContent: 'center'}}>
                <Button
                    sx={{m: 1, width: 1 / 4, alignSelf: 'center'}}
                    variant="contained"


                    onClick={() => {
                        setShowPomodoro(true);
                    }}
                    endIcon={<AdjustIcon/>}
                >
                </Button>

                <Button
                    sx={{m: 1, width: 1 / 4, alignSelf: 'center'}}
                    variant="contained"
                    // @ts-ignore
                    color={color}
                    endIcon={<CheckIcon/>}
                    onClick={() => {
                        // @ts-ignore
                        if ("taskId" in props.task) {
                            props.handleCompleteTask(props.task.taskId)
                        }
                    }}
                >
                </Button>
            </div>
            {showPomodoro && (<PomodoroTimer task={props.task}/>)}



        </HoverCardBox>

    )
        ;
}
