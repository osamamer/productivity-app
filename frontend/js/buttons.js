import {endTaskSession, pauseTaskSession, startTaskSession} from "./tasks";

const PLAY_IMG = "images/play.png";
const PAUSE_IMG = "images/pause.png";
const DELETE_IMG = "images/close.png";
const DOTS_IMG = "images/dots.png";

import {deleteTask, getTaskRunning} from './backend-calls'

function createTaskActionButton(action, taskJson, idSupplier, otherButtonIdSupplier, sessionFunction, buttonImage) {
    const button = document.createElement("img");
    button.src = buttonImage;
    button.classList.add(`${action}-task-button`);
    button.classList.add("pointer");
    button.classList.add("task-button");
    const taskId = taskJson["taskId"];
    button.textContent = `${action} session`;
    button.setAttribute("id", idSupplier(taskId));
    button.onclick = async () => {
        await sessionFunction(taskId);
    }
    return button;
}
export async function createStartSessionButtons(taskJson) {
    let button = createTaskActionButton("start", taskJson, getStartSessionButtonId, getEndSessionButtonId, startTaskSession, PLAY_IMG);
    if (await getTaskRunning(taskJson["taskId"].toString())) {
        button.setAttribute("style", "display: none");
    }
    return button;
}
export async function createPauseSessionButton(taskJson) {
    let button = createTaskActionButton("end", taskJson, getEndSessionButtonId, getStartSessionButtonId, pauseTaskSession, PAUSE_IMG);
    if (!await getTaskRunning(taskJson["taskId"].toString())) {
        button.setAttribute("style", "display: none");
    }
    return button;
}
export function createDeleteTaskButton(taskJson) {
    return createTaskActionButton("delete", taskJson, getDeleteTaskButtonId, getDeleteTaskButtonId, deleteTask, DELETE_IMG);
}
function getButtonId(taskId, buttonAction) {
    return `${buttonAction}-button-${taskId}`;
}
export function getStartSessionButtonId(taskId) {
    return getButtonId(taskId, "start-session");
}
export function getEndSessionButtonId(taskId) {
    return getButtonId(taskId, "end-session");
}
function getDeleteTaskButtonId(taskId) {
    getButtonId(taskId, "delete-task");
}