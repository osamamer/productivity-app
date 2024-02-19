import {
    getTaskRunning,
    deleteTask,
    postRequest,
    getTaskById,
    submitDescription,
    getAccumulatedTime,
    getTaskActive,
    changeTaskName, completeTask
} from './backend-calls'
import {
    createStartSessionButton,
    createPauseSessionButton,
    createDeleteTaskButton,
    getStartSessionButtonId, getEndSessionButtonId
} from './buttons';
import {displayTasks, fetchTasks, createAndAppendChild} from "./main";

const highlightedTaskBox = document.getElementById("highlighted-task-box");
const taskContextMenu = document.getElementById("task-context-menu");
let focusDuration = 30;
export async function createTaskElement(taskJson) {
    let taskId = taskJson["taskId"];
    const taskDiv = document.createElement("div");
    taskDiv.classList.add("task-div");
    taskDiv.setAttribute("id", taskId);
    taskDiv.setAttribute("draggable", true);
    const startButton = await createStartSessionButton(taskJson);
    const pauseButton = await createPauseSessionButton(taskJson);
    const deleteButton = createDeleteTaskButton(taskJson);
    const checkBox = await createCheckBox(taskId);
    taskDiv.appendChild(checkBox);
    await createAndAppendChild(null, taskJson['name'], false, null, ['task-div-text'], taskDiv);
    taskDiv.appendChild(startButton);
    taskDiv.appendChild(pauseButton);
    taskDiv.appendChild(deleteButton);
    taskDiv.addEventListener('click', function(event){
        if (!deleteButton.contains(event.target))
            highlightTask(taskId);
    });
    addRightClickHandler(taskDiv, taskJson);
    return taskDiv;
}
async function createCheckBox(taskId) {
    const checkBox = new Image();
    checkBox.src = '../images/checkbox.png';
    checkBox.classList.add("task-button");
    checkBox.addEventListener('click', async function () {
        await completeTask(taskId);
    })
    const inner = document.createElement("div")
    inner.classList.add("inner")
    checkBox.appendChild(inner);
    console.log('Created checkbox')
    return checkBox;
}
export async function startTaskSession(taskId, period, hasPeriod) {
    const tasks = await fetch('http://localhost:8080/api/v1/task');
    const tasksResponse = await tasks.json();
    for (let i = 0; i < tasksResponse.length; i++) {
        if (tasksResponse[i]["taskId"] !== taskId && await getTaskActive(tasksResponse[i]["taskId"])) {
            console.log(`Cannot start task because other task ${i} is running`)
            return;
        }
    }
    console.log("Starting task session");
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    await postRequest(taskId, "start-session");
    switchPlayPause(buttonId, otherButtonId);
    setFocusButtonDisplays("running");
    if (!hasPeriod) {
        startStopwatch(0, false);
    }
    else {
        startStopwatch(focusDuration, true);
    }
}
export async function pauseTaskSession(taskId, period, hasPeriod) {
    const buttonId = getEndSessionButtonId(taskId);
    const otherButtonId = getStartSessionButtonId(taskId);
    console.log("Pausing task session");
    stopStopwatch(intervalId);
    await postRequest(taskId, "pause-session");
    switchPlayPause(buttonId, otherButtonId);
    setFocusButtonDisplays("active");

}
export async function unpauseTaskSession(taskId, period, hasPeriod) {
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    console.log("Unpausing task session");
    startStopwatch(intervalId);
    await postRequest(taskId, "unpause-session");
    switchPlayPause(buttonId, otherButtonId);
    setFocusButtonDisplays("running");

}
export async function endTaskSession(taskId) {
    const buttonId = getEndSessionButtonId(taskId);
    const otherButtonId = getStartSessionButtonId(taskId);
    console.log("Ending task session");
    switchPlayPause(buttonId, otherButtonId);
    setFocusButtonDisplays("inactive");
    stopStopwatch(intervalId);
    clearStopwatch();
    await postRequest(taskId, "end-session");
}
let intervalId;
let totalElapsedTime = 0;
function startStopwatch(period, hasPeriod) {
    let timerDiv = document.getElementById("timer-div");
    timerDiv.setAttribute("style", "visibility: visible");
    let startTime = Date.now();
    intervalId = setInterval(function () {
        updateStopwatch();
    }, 1000);
    if (hasPeriod) {
        setTimeout(function() { stopStopwatch(); }, period*60000);
        //console.log(`Finished ${period} minute long focus`);
    }
}
function stopStopwatch() {
    clearInterval(intervalId); // stop the interval
}
function updateStopwatch() {
    totalElapsedTime += 1000;
    const seconds = Math.floor(totalElapsedTime / 1000) % 60; // calculate seconds
    const minutes = Math.floor(totalElapsedTime / 1000 / 60) % 60; // calculate minutes
    const hours = Math.floor(totalElapsedTime / 1000 / 60 / 60); // calculate hours
    document.getElementById("timer-div-text").textContent = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds); // update the display
}
function clearStopwatch() {
    totalElapsedTime = -1000;
    updateStopwatch();
    let timerDiv = document.getElementById("timer-div");
    timerDiv.setAttribute("style", "visibility: hidden");
}
function switchPlayPause(buttonId, otherButtonId) {
    const taskButton = document.getElementById(buttonId);
    const otherTaskButton = document.getElementById(otherButtonId);
    taskButton.setAttribute("style", "display: none");
    otherTaskButton.setAttribute("style", "display: block");
}
async function highlightTask(taskId) {
    highlightedTaskBox.innerHTML = "";
    highlightedTaskBox.setAttribute("style", "visibility: visible");
    let task = await getTaskById(taskId);

    const taskHeader =  await createAndAppendChild('highlighted-task-header', task['name'], false, null, ['highlighted-task-text'], highlightedTaskBox);
    await setupFocusButtons(task);
    const taskDescription = await createAndAppendChild('highlighted-task-desc', task['description'], false, null, ['highlighted-task-text'], highlightedTaskBox);
    const taskTime = await createAndAppendChild('highlighted-task-time', 'Elapsed time: ', true, displayTaskTime(task['taskId']), ['highlighted-task-text'], highlightedTaskBox);

    taskDescription.setAttribute("contenteditable", "true");
    taskHeader.setAttribute("contenteditable", "true");

    taskHeader.addEventListener("input", async function () {
        console.log("Changing name");
        await changeTaskName(taskId, taskHeader.textContent).then(() => fetchTasks()).then((tasks) => displayTasks(tasks));
    }, false);
    taskDescription.addEventListener("input", function () {
        console.log("Changing description");
        submitDescription(task["taskId"], taskDescription.textContent);
    }, false);
}
async function setupFocusButtons(task) {
    await setupFocusButton('start', task);
    await setupFocusButton('pause', task);
    await setupFocusButton('unpause', task);
    await setupFocusButton('end', task);
    let taskRunning = await getTaskRunning(task["taskId"]);
    let taskActive = await getTaskActive(task["taskId"]);
    let status;
    if (!taskActive && !taskRunning) status = "inactive";
    else if (taskActive && !taskRunning) status = "active";
    else if (taskRunning) status = "running";
    setFocusButtonDisplays(status);
}
async function setupFocusButton(purpose, task) {
    let id = `${purpose}-focus-button`;
    let text;
    if (purpose === 'start')
        text = `Start focus for ${focusDuration} minutes`;
    else if (purpose === 'end')
        text = 'End focus';
    else
        text = capitalizeFirstLetter(purpose);
    let button = await createAndAppendChild(id, text, false, null, ['focus-button'], highlightedTaskBox);
    button.taskId = task['taskId'];
    button.purpose = purpose;
    button.addEventListener("click", buttonEventListenerFunction, false);
    return button;
}
function setFocusButtonDisplays(status) { // POSSIBLE PROBLEM: task not highlighted; focus buttons don't exist.
    // status: 0 for inactive, 1 for active but not running, 2 for active and running
    const startButton = document.getElementById("start-focus-button");
    const pauseButton = document.getElementById("pause-focus-button");
    const unpauseButton = document.getElementById("unpause-focus-button");
    const endButton = document.getElementById("end-focus-button");

    let booleans;
    if (status === "inactive")
        booleans = [true, false, false, false];
    else if (status === "active")
        booleans = [false, false, true, true];
    else if (status === "running")
        booleans = [false, true, false, false];

    if (booleans[0]) startButton.setAttribute("style", "display: block");
    else startButton.setAttribute("style", "display: none");

    if (booleans[1]) pauseButton.setAttribute("style", "display: block");
    else pauseButton.setAttribute("style", "display: none");

    if (booleans[2]) unpauseButton.setAttribute("style", "display: block");
    else unpauseButton.setAttribute("style", "display: none");

    if (booleans[3]) endButton.setAttribute("style", "display: block");
    else endButton.setAttribute("style", "display: none");
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function buttonEventListenerFunction(e) {
    let button = e.currentTarget;
    let purpose = button.purpose;
    if (purpose === "start") startTaskSession(button.taskId, 0, false);
    if (purpose === "pause") pauseTaskSession(button.taskId, 0, false);
    if (purpose === "unpause") unpauseTaskSession(button.taskId, 0, false);
    if (purpose === "end") {
        endTaskSession(button.taskId);
        highlightTask(button.taskId);
    }
}
async function displayTaskTime(taskId) {
    let accTime = await getAccumulatedTime(taskId);
    const seconds = Math.floor(accTime) % 60; // calculate seconds
    const minutes = Math.floor(accTime/ 60) % 60; // calculate minutes
    const hours = Math.floor(accTime / 60 / 60); // calculate hours
    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
}
function pad(number) {
    // add a leading zero if the number is less than 10
    return (number < 10 ? "0" : "") + number;
}
function addRightClickHandler(taskDiv, taskJson) {
    taskDiv.addEventListener('contextmenu', function(e) {
        openContextMenu(e);
        const taskId = taskJson["taskId"];
        setupContextMenu(taskId);
    }, false);
}
function openContextMenu(e) {
    console.log("Opened task context menu");
    e.preventDefault();
    taskContextMenu.setAttribute("style", "visibility: visible");
    taskContextMenu.style.left = e.pageX +"px";
    taskContextMenu.style.top = e.pageY - 25 +"px";
}

async function setupContextMenu(taskId) {
    taskContextMenu.innerHTML = "";
    const startItem = await createContextMenuItem('start-task-context-item', "Start session", false, null, ['menu-item'], taskContextMenu, taskId, startTaskSession);
    const pauseItem = await createContextMenuItem('pause-task-context-item', "Pause", false, null, ['menu-item'], taskContextMenu, taskId, pauseTaskSession);
    const unpauseItem = await createContextMenuItem('unpause-task-context-item', "Unpause", false, null, ['menu-item'], taskContextMenu, taskId, unpauseTaskSession);
    const endItem = await createContextMenuItem('end-task-context-item', "End session", false, null, ['menu-item'], taskContextMenu, taskId, endTaskSession);
    const descItem = await createContextMenuItem('task-desc-context-item', "Description", false, null, ['menu-item'], taskContextMenu, taskId, pauseTaskSession);
    // Need to create a function for the description. Some sort of popup.

}
async function createContextMenuItem(id, text, requiresFunction, textFunction, classes, parent, taskId, clickFunction) {
    const item = await createAndAppendChild(id, text, requiresFunction, textFunction, classes, parent);
    item.addEventListener('click', function () {
        highlightTask(taskId);
        clickFunction(taskId);
        parent.setAttribute("style", "visibility: hidden");
    })
    return item;
}
