import {Task} from "../interfaces/Task.tsx";
import React from "react";
import {TaskDiv} from "./TaskDiv.tsx";
type props = {tasks: Task[], type: string, toggleTaskCompletion: (taskId: number) => void};
export function TaskBox(props: props) {
    return (
        <div id='today-tasks-container' className="box box-shadow container">
            <h1 className="box-header">{`${props.type}'s tasks`}</h1>
            <img src="../images/add.png" alt="" id="add-task-button"
                 className="button-class add-task-button" title="Add task"/>
            <div className="tasks-div" id="today-tasks-div">
                      {props.tasks.map((task: Task) => (
                <TaskDiv task={task} toggleTaskCompletion={props.toggleTaskCompletion}/>
            ))}
            </div>
        </div>
    );
}