"use strict" // strict mode

import {
    getTaskRunning,
    deleteTask,
    postRequest,
    getTaskById,
    submitDescription,
    getAccumulatedTime,
    getTaskActive,
    changeTaskName, completeTask, getHighestPriorityTask, setTodayInfo
} from './backend-calls'
import {
    createStartSessionButton,
    createPauseSessionButton,
    createDeleteTaskButton,
    getStartSessionButtonId, getEndSessionButtonId
} from './buttons';
import {displayTasks, fetchAllTasks, createAndAppendChild, fetchTodayNonCompletedTasks} from "./main";

const highlightedTaskBox = document.getElementById("highlighted-task-box");
const taskContextMenu = document.getElementById("task-context-menu");
let focusSettingsBox = document.getElementById("focus-settings-box");
let defaultFocusDuration = 30;
const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

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

    function setPriorityCircleColor() {
        // taskDiv.setAttribute('--prioritycolor', '--priorityyellow');
        let color;
        if (taskJson['importance'] <= 3) color = 'var(--priorityblue)';
        else if (3 < taskJson['importance'] && taskJson['importance'] <= 6) color = 'var(--priorityyellow)';
        else if (6 < taskJson['importance']) color = 'var(--priorityred)';
        taskDiv.style.setProperty('--prioritycolor', color);
        // let styles = window.getComputedStyle(taskDiv, ':before');
        // let content = styles['content'];
        // console.log(styles);
    }

    setPriorityCircleColor();
    addRightClickHandler(taskDiv, taskJson);
    return taskDiv;
}
async function createCheckBox(taskId) {
    const checkBox = new Image();
    checkBox.src = '../images/checkbox.png';
    checkBox.classList.add("task-button");
    checkBox.addEventListener('click', async function () {
        await completeTask(taskId).then(() => fetchTodayNonCompletedTasks())
            .then((tasksString) => displayTasks(tasksString));
    })
    const inner = document.createElement("div")
    inner.classList.add("inner")
    checkBox.appendChild(inner);
    return checkBox;
}
export async function startPomodoro(taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown) {
    console.log("Starting pomodoro")
    await fetch(TASK_URL.concat("/start-pomodoro"), {
        method: "POST",
        body: JSON.stringify({
            taskId: taskId,
            focusDuration: focusDuration,
            shortBreakDuration: shortBreakDuration,
            longBreakDuration: longBreakDuration,
            numFocuses: numFocuses,
            longBreakCooldown: longBreakCooldown
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    });
}
export async function startTaskSessionFrontend(taskId, period, hasPeriod) {
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
    // if (hasPeriod) {
    startStopwatch(period, false);
    // }
    // else {
    //     startStopwatch(defaultFocusDuration, false);
    // }
}
export async function pauseTaskSessionFrontend(taskId, period, hasPeriod) {
    const buttonId = getEndSessionButtonId(taskId);
    const otherButtonId = getStartSessionButtonId(taskId);
    console.log("Pausing task session");
    stopStopwatch(intervalId);
    await postRequest(taskId, "pause-session");
    switchPlayPause(buttonId, otherButtonId);
    setFocusButtonDisplays("active");

}
export async function unpauseTaskSessionFrontend(taskId, period, hasPeriod) {
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    console.log("Unpausing task session");
    startStopwatch(intervalId);
    await postRequest(taskId, "unpause-session");
    switchPlayPause(buttonId, otherButtonId);
    setFocusButtonDisplays("running");

}
export async function endTaskSessionFrontend(taskId) {
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
    timerDiv.setAttribute("style", "display: block");
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

export async function highlightTask(taskId) {
    focusSettingsBox.setAttribute("style", "visibility: hidden");

    highlightedTaskBox.innerHTML = "";
    highlightedTaskBox.setAttribute("style", "visibility: visible");
    let task = await getTaskById(taskId);
    const taskHeader =  await createAndAppendChild('highlighted-task-header', task['name'], false, null, ['highlighted-task-text'], highlightedTaskBox);
    await setupFocusButtons(task);
    const focusSettingsButton = await createAndAppendChild('focus-settings-button', 'Get to work', false, null, ['focus-button'], highlightedTaskBox);
    const taskDescription = await createAndAppendChild('highlighted-task-desc', task['description'], false, null, ['highlighted-task-text'], highlightedTaskBox);
    const taskTime = await createAndAppendChild('highlighted-task-time', 'Elapsed time: ', true, displayTaskTime(task['taskId']), ['highlighted-task-text'], highlightedTaskBox);
    taskHeader.setAttribute("contenteditable", "true");

    // if (taskDescription.textContent === "") taskDescription.textContent = "Description"
    focusSettingsBox = await setupFocusSettingsBox(taskId);
    taskDescription.classList.add('editable');
    taskDescription.setAttribute("contenteditable", "true");
    taskDescription.setAttribute("data-placeholder", "Type something...")
    const placeholderText = 'Description...';

    taskDescription.setAttribute('data-placeholder', placeholderText);
    // taskDescription.addEventListener('input', () => {
    //     if (taskDescription.textContent.trim() === '') {
    //         taskDescription.setAttribute('data-placeholder', placeholderText);
    //     } else {
    //         taskDescription.setAttribute('data-placeholder', "1");
    //     }
    // });
    taskDescription.addEventListener('keydown', (event) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (taskDescription.textContent.trim() === '') {
                taskDescription.setAttribute('data-placeholder', placeholderText);
            }
        }
    });
    taskDescription.addEventListener('onblur', () => {
            taskDescription.setAttribute('data-placeholder', placeholderText);

    });
    focusSettingsButton.addEventListener('click', function () {
        focusSettingsBox.setAttribute("style", "display: block");
        focusSettingsButton.setAttribute("style", "display: none");
    })

    taskHeader.addEventListener("input", async function () {
        console.log("Changing name");
        await changeTaskName(taskId, taskHeader.textContent).then(() => fetchTodayNonCompletedTasks()).then((tasks) => displayTasks(tasks));
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
        text = `Start ${defaultFocusDuration}-minute focus`;
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
    if (purpose === "start") startTaskSessionFrontend(button.taskId, 0, false);
    if (purpose === "pause") pauseTaskSessionFrontend(button.taskId, 0, false);
    if (purpose === "unpause") unpauseTaskSessionFrontend(button.taskId, 0, false);
    if (purpose === "end") {
        endTaskSessionFrontend(button.taskId);
        highlightTask(button.taskId);
    }
}
function setupFocusSettingsBox(taskId) {
    const focusSettingsBox = document.getElementById('focus-settings-box');
    focusSettingsBox.innerHTML = '';
    const pomodoroForm = document.createElement("form");
    const focusSettingsHeader = document.createElement("div");
    focusSettingsHeader.setAttribute("id", "focus-settings-header");
    focusSettingsHeader.textContent = "Let's get to work";
    let pomoHTML = `
    <p><input id="focus-duration-input" type="number" placeholder="Focus period duration (minutes)" class="input" min="1" max="60"></p>
    <p><input id="short-break-duration-input" type="number" placeholder="Short break duration (minutes)" class="input" min="1" max="60"></p>
    <p><input id="long-break-duration-input" type="number" placeholder="Long break duration (minutes)" class="input" min="1" max="60"></p>
    <p><input id="number-focuses-input" type="number" placeholder="How many focus periods?" class="input" min="2" max="6"></p>
    <p><input id="long-break-cooldown-input" type="text" placeholder="Long break every...?" class="input" min="2" max="6"></p>
    <button class="button-class" type="submit">Go</button> `;
    pomodoroForm.innerHTML = pomoHTML;
    pomodoroForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const focusDuration = document.getElementById('focus-duration-input').value;
        const shortBreakDuration = document.getElementById('short-break-duration-input').value;
        const longBreakDuration = document.getElementById('long-break-duration-input').value;
        const numFocuses = document.getElementById('number-focuses-input').value;
        const longBreakCooldown = document.getElementById('long-break-cooldown-input').value;
        startPomodoro(taskId, focusDuration, shortBreakDuration, longBreakDuration, numFocuses, longBreakCooldown).then(() => fetchTodayNonCompletedTasks())
            .then((tasksString) => displayTasks(tasksString));
    })
    focusSettingsBox.appendChild(focusSettingsHeader);
    focusSettingsBox.appendChild(pomodoroForm);
    return focusSettingsBox;
}
export async function setupHighPriorityTaskBox() {
    let highestPriorityTaskBox = document.getElementById('highest-priority-task-box');
    highestPriorityTaskBox.setAttribute("style", "visibility: visible");

    highestPriorityTaskBox.innerHTML = "";
    let header = document.createElement("div");
    let task = await getHighestPriorityTask();
    header.textContent = task["name"];
    // console.log(task["name"])
    highestPriorityTaskBox.appendChild(header);
    // highestPriorityTaskBox.textContent = task['name']
    // let HighPriorityBoxHeader = createAndAppendChild('high-priority-box-header', '', true, )

}
function validateForm(form) {
    let a = document.forms["Form"]["answer_a"].value;
    let b = document.forms["Form"]["answer_b"].value;
    let c = document.forms["Form"]["answer_c"].value;
    let d = document.forms["Form"]["answer_d"].value;
    if ((a == null || a == "") && (b == null || b == "") && (c == null || c == "") && (d == null || d == "")) {
        alert("Please Fill In All Required Fields");
        return false;
    }
}
async function displayTaskTime(taskId) {
    let accTime = await getAccumulatedTime(taskId);
    Math.floor(accTime);
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
    const startItem = await createContextMenuItem('start-task-context-item', "Start session", false, null, ['menu-item'], taskContextMenu, taskId, startTaskSessionFrontend);
    const pauseItem = await createContextMenuItem('pause-task-context-item', "Pause", false, null, ['menu-item'], taskContextMenu, taskId, pauseTaskSessionFrontend);
    const unpauseItem = await createContextMenuItem('unpause-task-context-item', "Unpause", false, null, ['menu-item'], taskContextMenu, taskId, unpauseTaskSessionFrontend);
    const endItem = await createContextMenuItem('end-task-context-item', "End session", false, null, ['menu-item'], taskContextMenu, taskId, endTaskSessionFrontend);
    const descItem = await createContextMenuItem('task-desc-context-item', "Description", false, null, ['menu-item'], taskContextMenu, taskId, pauseTaskSessionFrontend);
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
