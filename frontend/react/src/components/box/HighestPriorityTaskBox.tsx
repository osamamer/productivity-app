import React, {useEffect, useState} from "react";
import {Task} from "../../types/Task.tsx";
import {DayEntity} from "../../types/DayEntity.tsx";
import {TaskToCreate} from "../../types/TaskToCreate.tsx";
import {Box, Card, Typography} from "@mui/material";
import {HoverCardBox} from "./HoverCardBox";

const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

async function fetchHighestPriorityTask(): Promise<Task> {
    const response = await fetch(TASK_URL.concat('/get-newest-uncompleted-highest-priority-task'), {
        method: "GET"
    });
    return response.json();
}

type props = { tasks: Task[] };

export function HighestPriorityTaskBox(props: props) {
    const [highestPriorityTask, setHighestPriorityTask] = useState<Task>({} as Task);

    useEffect(() => {
        // console.log("Yo im fetchin my shit sticky")
        fetchHighestPriorityTask().then((task) => {
            // TODO: Handle case of no tasks (currently throws error and prevents whole site from rendering)
            setHighestPriorityTask(task)
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