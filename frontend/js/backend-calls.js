"use strict" // strict mode
import {fetchAllTasks, displayTasks, fetchTasks, getCurrentDateFormatted} from './main'
const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");
const DAY_URL = ROOT_URL.concat("/api/v1/day");
const todayDate = getCurrentDateFormatted();

async function getRequest(taskId, action) {
    return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
    })
}
export async function postRequest(taskId, action) {
    return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
        method: "POST",
    })
}
export async function getAllTasks() {
    let promise = await fetch(TASK_URL);
    return await promise.json();
}
export async function getTasks(date, nonCompletedOnly) {
    let promise;
    if (nonCompletedOnly) {
        promise = await fetch(TASK_URL.concat(`/get-non-completed-tasks/${date}`),{
            method: "GET",
        });
    }
    else {
        promise = await fetch(TASK_URL.concat(`/get-tasks/${date}`),{
            method: "GET",
        })
    }
    return await promise.json();
}
export async function startTaskSession(taskId) {
    return await postRequest(taskId, "start-session");
}
export async function pauseTaskSession(taskId) {
    return await postRequest(taskId, "pause-session");
}
export async function unpauseTaskSession(taskId) {
    return await postRequest(taskId, "unpause-session");
}
export async function endTaskSession(taskId) {
    return await postRequest(taskId, "end-session");
}
export async function deleteTask(taskId) {
    let highlightDiv = document.getElementById("highlighted-task-box");
    highlightDiv.style.visibility = 'hidden';
    await fetch(TASK_URL.concat(`/${taskId}`), { // `` makes something into a string
        method: "DELETE",
    })
        .then(() => fetchTasks(todayDate, true))
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
export async function createTask(name, description, scheduledTime, tag, importance) {
    return await fetch(TASK_URL.concat("/create-task"), { // `` makes something into a string
        method: "POST",
        body: JSON.stringify({
            taskName: name,
            taskDescription: description,
            taskPerformTime: scheduledTime,
            taskTag: tag,
            taskImportance: importance,
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
export async function completeTask(taskId) {
    console.log("Completing task");
    await fetch(TASK_URL.concat(`/complete-task/${taskId}`), {
        method: "POST",
    })
}
export async function getTaskCompleted(taskId) {
    await fetch(TASK_URL.concat(`/get-task-completed/${taskId}`), {
        method: "GET",
    })
}
export async function getNonCompletedTasks() {
    await fetch(TASK_URL.concat("/get-non-completed-tasks"), {
        method: "GET",
    })
}
export async function getTodayTasks() {
    await fetch(TASK_URL.concat("/get-today-tasks"), {
        method: "GET",
    })
}
export async function getTasksByDate(date) {
    await fetch(TASK_URL.concat(`/get-tasks/${date}`), {
        method: "GET",
    })
}
export async function getHighestPriorityTask() {

    let promise = await fetch(TASK_URL.concat(`/get-newest-uncompleted-highest-priority-task`), {
        method: "GET",
    })
    return await promise.json();
}

// ---------------------------------Day calls--------------------------------------------

export async function getToday() {
    const response = await fetch(DAY_URL.concat("/get-today"));
    return await response.json();
}
export async function setTodayInfo(rating, plan, summary) {
    await fetch(DAY_URL.concat('/set-today-info'), {
        method: "POST",
        body: JSON.stringify({
            dayRating: rating,
            dayPlan: plan,
            daySummary: summary
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
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
export async function getDaySummary(date) {
    const response = await fetch(DAY_URL.concat(`/get-day-summary/${date}`));
    return await response.json();
}
export async function getDayPlan(date) {
    // let promise =  await fetch(DAY_URL.concat(`/get-day-plan/${date}`), {
    //     method: "POST",
    // })
    // return await promise.json();
    const response = await fetch(DAY_URL.concat(`/get-day-plan/${date}`));
    return await response.json();
}
export async function endAllSessions() {
    await fetch(TASK_URL.concat("/end-all-sessions"), {
        method: "POST"
    });
    console.log("Ended all sessions");
}

