const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");
const DAY_URL = ROOT_URL.concat("/api/v1/day");

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
    let highlightDiv = document.getElementById("highlighted-task-div");
    highlightDiv.style.visibility = 'hidden';
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
export async function getTaskActive(taskId) {
    let promise = await fetch(TASK_URL.concat(`/get-task-active/${taskId}`), { // `` makes something into a string
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
export async function changeTaskName(taskId, newName) {
    return await fetch(TASK_URL.concat(`/change-task-name/${taskId}/${newName}`), { // `` makes something into a string
        method: "POST",
    })
}
async function getToday() {
    const response = await fetch(DAY_URL.concat("/get-today"));
    return await response.json();
}
export async function getTodayRating() {
    let today = await getToday();
    return today["rating"];
}
export async function setTodayRating(rating) {
    await fetch(DAY_URL.concat(`/set-today-rating/${rating}`), {
        method: "POST",
    })
}
export async function setDayPlan(date, plan){
    return await fetch(DAY_URL.concat('/set-day-plan'), {
        method: "POST",
        body: JSON.stringify({
            dayDate: date,
            dayPlan: plan
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
}
export async function setDaySummary(date, summary){
    return await fetch(DAY_URL.concat('/set-day-summary'), {
        method: "POST",
        body: JSON.stringify({
            dayDate: date,
            daySummary: summary
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
}

export async function endAllSessions() {
    await fetch(TASK_URL.concat("/end-all-sessions"), {
        method: "POST"
    });
    console.log("Ended all sessions");
}

