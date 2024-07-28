import React, {useEffect, useState} from "react";
import {Task} from "../interfaces/Task.tsx";
import {DayEntity} from "../interfaces/DayEntity.tsx";
import {TaskToCreate} from "../interfaces/TaskToCreate.tsx";
const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");
async function fetchHighestPriorityTask(): Promise<Task> {
    const response = await fetch(TASK_URL.concat('/get-newest-uncompleted-highest-priority-task'), {
        method: "GET"
    });
    return response.json();
}
type props = {tasks: Task[]};
export function HighestPriorityTaskBox(props: props) {
    const [highestPriorityTask, setHighestPriorityTask] = useState<Task>({} as Task);

    useEffect(() => {
        console.log("Yo im fetchin my shit sticky")
        fetchHighestPriorityTask().then((task) => {
            // TODO: Handle case of no tasks (currently throws error and prevents whole site from rendering)
            setHighestPriorityTask(task)});
    }, [props.tasks]);

    return (
        <div className="box container" id="highest-priority-task-box">
            <div id="priority-task-text" className="highlighted-task-text">
                {highestPriorityTask.name}
            </div>
        </div>
    );
}