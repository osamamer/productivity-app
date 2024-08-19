import React from "react";
import { Task } from "../interfaces/Task.tsx";
import { DialogContent, styled } from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import { PomodoroDialog } from "./PomodoroDialog.tsx";
import { OvalButton } from "../pages/HomePage.tsx";

type Props = {
    task?: Task | null;
    handleOpenDialog?: (dialogType: string) => void;
};

export function HighlightedTaskBox({ task, handleOpenDialog }: Props) {
    if (!task) {
        return null; // or return some fallback UI if task is null/undefined
    }

    return (
        <div className="box container" id="highlighted-task-box">
            <div id="highlighted-task-header" className="highlighted-task-text">
                {task.name ?? "No Task Name"}
            </div>
            <div className="highlighted-task-text">
                {task.description ?? "No Description Available"}
            </div>
            <OvalButton
                sx={{ m: 1 }}
                variant="contained"
                color="primary"
                onClick={() => {
                    handleOpenDialog?.('pomodoroDialog');
                }}
            >
                POMODORO SESSION
            </OvalButton>
            <OvalButton
                sx={{ m: 1 }}
                variant="contained"
                color="secondary"
            >
                START WORK
            </OvalButton>
        </div>
    );
}
