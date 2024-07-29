import {Task} from "../interfaces/Task.tsx";
import React from "react";
import {TaskDiv} from "./TaskDiv.tsx";
import {OvalButton} from "../App.tsx";
type props = {tasks: Task[], type: string, toggleTaskCompletion: (taskId: number) => void,
    onDivClick: (task: Task) => void, handleButtonClick: (dialogType: string) => void};
export function TaskBox(props: props) {
    return (
        <div id={`${props.type}-tasks-container`} className="box box-shadow container">
            <h1 className="box-header">{`${props.type}'s tasks`}</h1>
            <OvalButton sx={{width: 1/2}} variant="contained" color="primary" onClick={() => {
                props.handleButtonClick('createTaskDialog')
            }}>New task</OvalButton>
            <div className="tasks-div" id="today-tasks-div">
                      {props.tasks.map((task: Task) => (
                <TaskDiv task={task} toggleTaskCompletion={props.toggleTaskCompletion} onClick={props.onDivClick}/>
            ))}
            </div>
        </div>
    );
}