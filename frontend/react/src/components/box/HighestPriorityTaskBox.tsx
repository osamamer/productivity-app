import React, {useEffect, useState} from "react";
import {Task} from "../../types/Task.tsx";
import {Typography} from "@mui/material";
import {HoverCardBox} from "./HoverCardBox";
import {taskService} from "../../services/api";

type props = { tasks: Task[] };

export function HighestPriorityTaskBox(props: props) {
    const [highestPriorityTask, setHighestPriorityTask] = useState<Task>({} as Task);

    useEffect(() => {
        taskService.getHighestPriorityTask().then((task) => {
            setHighestPriorityTask(task)
        }).catch(() => {
            // No tasks or error — leave as empty
        });
    }, [props.tasks]);
    let importance;

    if (!(highestPriorityTask) || highestPriorityTask.importance <= 3) {
        importance = "low";
    } else if (3 < highestPriorityTask.importance && highestPriorityTask.importance <= 7) {
        importance = "medium";

    } else {
        importance = "high";
    }
    let color = importance;

    if (props.tasks.length === 0) {
        return null;
    }
    return (
        <HoverCardBox
            height="10%"
            maximumHeight="90px"
        >
            <Typography>You should probably get to this one . . . </Typography>
            <Typography sx={{color: `${color}.main`}}>{highestPriorityTask.name}</Typography>
        </HoverCardBox>
    );
}