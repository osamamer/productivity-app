const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

import {createTaskElement} from './tasks';
import {displayTodayRating} from './backend-calls';

window.onload = async function() {
    let taskElements = await fetchTasks();
    displayTasks(taskElements);
    await displayTodayRating();
}
const inputForm=document.getElementById("task-input-form");
inputForm.addEventListener('submit', function(e) {
    console.log("Trying to submit eh?");
    e.preventDefault();
    createNewTask();
}, false);
export async function fetchTasks () {
    const response = await fetch('http://localhost:8080/api/v1/task');
    const responseJson = await response.json();
    let taskElements = [];
    if (responseJson.length === 0) return taskElements;
    for (let i = 0; i < responseJson.length; i++) {
        let taskElement = await createTaskElement(responseJson[i]);
        taskElements.push(taskElement);
    }
    return taskElements;
}
export function displayTasks (taskElements) {
    document.getElementById("all-tasks-div").innerHTML = "";
    for (let i = 0; i < taskElements.length; i++) {
        document.getElementById("all-tasks-div").appendChild(taskElements[i]);
    }
}
async function createNewTask (){
    //e.preventDefault();
    const userTaskName = document.getElementById("task-input-field").value;
    if (userTaskName.trim() === "") return;
    document.getElementById("task-input-field").value = "";
    console.log("Creating task: " + userTaskName);
    await fetch(TASK_URL, {
        method: "POST",
        body: JSON.stringify({
            taskName: userTaskName,
            taskDescription: "Description"
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}

// TODO
// Bugs to fix:
// 1. When you delete all tasks, there is an exception.
// 2. Set up timer box with pause and play and stop, and separate for each task.
