import React, {useEffect, useState} from "react";
import {Task} from "../interfaces/Task.tsx";
import {DayEntity} from "../interfaces/DayEntity.tsx";
import {TaskToCreate} from "../interfaces/TaskToCreate.tsx";
import {Box, Card, Typography} from "@mui/material";

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
        // <div className="box container" id="highest-priority-task-box">
        //     <div id="priority-task-text" className="highlighted-task-text">
        //         {highestPriorityTask.name}
        //     </div>
        // </div>
        <Card className="box-shadow box" sx={{
            display: 'flex', gap: 1, px: 4, py: 2, direction: 'column',
            '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 5,
        }}> <Typography>You should probably get to this . . . </Typography>
            <Typography sx={{color: `${color}.main`}}>{highestPriorityTask.name}</Typography>
        </Card>
    );
}