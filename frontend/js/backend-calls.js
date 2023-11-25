const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

import {fetchTasks, displayTasks} from './main'
async function getRequest(taskId, action) {
    return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
    })
}
export async function postRequest(taskId, action) {
    return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
        method: "POST",
    })
}
export async function deleteTask(taskId) {
    await fetch(TASK_URL.concat(`/${taskId}`), { // `` makes something into a string
        method: "DELETE",
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}
export async function getTaskById(taskId) {
    return (await getRequest(taskId, "get-task")).json();
}
export async function getTaskRunning(taskId) {
    let promise = await fetch(TASK_URL.concat(`/get-task-running/${taskId}`), { // `` makes something into a string
    })
    return await promise.json();
}
export async function getAccumulatedTime(taskId){
    let accTime =  await getRequest(taskId, "get-accumulated-time");
    return accTime.json();
}
export async function submitDescription(taskId, description) {
    console.log(description);
    return await fetch(TASK_URL.concat("/set-description"), { // `` makes something into a string
        method: "POST",
        body: JSON.stringify({
            taskId: taskId,
            taskDescription: description
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
}
async function getToday() {
    return await fetch(TASK_URL.concat("/get-today"));
}
export async function getTodayRating() {
    let today = (await getToday().then()).json();
    return today["rating"];
}

