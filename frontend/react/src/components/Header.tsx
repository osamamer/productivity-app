import React from "react";
import {Task} from "../types/Task.tsx";
import {TaskToCreate} from "../types/TaskToCreate.tsx";

type props = {onSubmit: (taskToCreate: TaskToCreate) => void};



export function Header(props: props) {
    const [newTask, setNewTask] = React.useState("");
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (newTask === "") return
        console.log(newTask)
        const taskToCreate: TaskToCreate = {
            name: newTask.valueOf(),
            description: "",
            scheduledPerformDateTime: "",
            tag: "",
            importance: 0};
        props.onSubmit(taskToCreate);
        setNewTask("");
    }

    return (
        <div className="header">
            <h1 className="head-question">What's on your mind?</h1>
            <div className="input-field-wrapper">
                <form onSubmit={handleSubmit} id="task-input-form"><label htmlFor="task-input-field"></label>
                    <input type="text"
                           value = {newTask}
                           onChange={(e) => setNewTask(e.target.value)}
                           id="task-input-field"
                           className="box-shadow"
                           placeholder="Add task..."/>
                </form>
            </div>
            <div className="day-rating" id="day-div"></div>
            <img className="sun-img-div" src="../images/sun.png" alt="" id="sun-image" title="Day"/>
        </div>);
}