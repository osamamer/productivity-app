import React from "react";
import {Task} from "../interfaces/Task.tsx";
import {Box, Card, DialogContent, styled, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import {PomodoroDialog} from "./PomodoroDialog.tsx";
import {OvalButton} from "../pages/HomePage.tsx";

type props = {
    task?: Task | null;
    handleOpenDialog?: (dialogType: string) => void;
};

export function HighlightedTaskBox(props: props) {
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
        return null; // or return some fallback UI if task is null/undefined
    }

    return (
        <Card className="box-shadow box" sx={{
            display: 'flex', gap: 1, px: 4, py: 2, minHeight: 200, direction: 'column',
            '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 5,
        }}>

            <Typography variant="h4" sx={{mb: 2}}>{props.task.name ?? "No task to highlight"}</Typography>
            {props.task.description && props.task.description.trim() !== '' &&
                <Typography variant="h5"
                            sx={{mb: 2}}>{props.task.description ?? "No description available"}</Typography>
            }
            <Button
                sx={{m: 1, width: 1/2, alignSelf: 'center'}}
                variant="contained"


                onClick={() => {
                    props.handleOpenDialog?.('pomodoroDialog');
                }}
            >
                POMODORO SESSION
            </Button>
            <Button
                sx={{m: 1, width: 1/2, alignSelf: 'center'}}
                variant="contained"
                color={color}
            >
                START WORK
            </Button>
        </Card>
        // <div className="box container" id="highlighted-task-box">
        //     <div id="highlighted-task-header" className="highlighted-task-text">
        //         {task.name ?? "No Task Name"}
        //     </div>
        //     <div className="highlighted-task-text">
        //         {task.description ?? "No Description Available"}
        //     </div>
        //
        // </div>

    )
        ;
}
