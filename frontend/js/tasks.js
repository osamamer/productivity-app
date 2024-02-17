import {
    getTaskRunning,
    deleteTask,
    postRequest,
    getTaskById,
    submitDescription,
    getAccumulatedTime,
    getTaskActive,
    changeTaskName
} from './backend-calls'
import {
    createStartSessionButton,
    createPauseSessionButton,
    createDeleteTaskButton,
    getStartSessionButtonId, getEndSessionButtonId
} from './buttons';
import {displayTasks, fetchTasks} from "./main";


const menuDiv = document.getElementById("task-context-menu");
let focusDuration = 30;
export async function createTaskElement(taskJson) {
    let taskId = taskJson["taskId"];
    const taskDiv = document.createElement("div");
    const taskHeader = document.createElement("p");
    taskDiv.classList.add("task-div");
    taskDiv.setAttribute("id", taskId);
    taskHeader.classList.add("task-div-text");
    taskHeader.textContent = taskJson["name"];
    const startButton = await createStartSessionButton(taskJson);
    const pauseButton = await createPauseSessionButton(taskJson);
    const deleteButton = createDeleteTaskButton(taskJson);
    taskDiv.appendChild(taskHeader);
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
    switchPlayPause(buttonId, otherButtonId, taskId, 2);
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
    switchPlayPause(buttonId, otherButtonId, taskId, 1);
}
export async function unpauseTaskSession(taskId, period, hasPeriod) {
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    console.log("Unpausing task session");

    startStopwatch(intervalId);
    await postRequest(taskId, "unpause-session");
    switchPlayPause(buttonId, otherButtonId, taskId, 2);
}
export async function endTaskSession(taskId) {
    const buttonId = getEndSessionButtonId(taskId);
    const otherButtonId = getStartSessionButtonId(taskId);
    console.log("Ending task session");
    switchPlayPause(buttonId, otherButtonId, taskId, 0);
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
    //console.log(intervalId)
    clearInterval(intervalId); // stop the interval
    // stopwatchInterval = null; // reset the interval variable
}
function updateStopwatch() {
    // const currentTime = new Date().getTime(); // get current time in milliseconds
    // const elapsedTime = currentTime - startTime; // calculate elapsed time in milliseconds
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
function switchPlayPause(buttonId, otherButtonId, taskId, status) {
    // status: 0 for inactive, 1 for active but not running, 2 for active and running
    const taskButton = document.getElementById(buttonId);
    const otherTaskButton = document.getElementById(otherButtonId);
    console.log(`Task button ID: ${buttonId}`);
    taskButton.setAttribute("style", "display: none");
    otherTaskButton.setAttribute("style", "display: block");
    // NOW FOR THE FOCUS BUTTONS
    const startFocusButton = document.getElementById("start-focus-button");
    const endFocusButton = document.getElementById("end-focus-button");
    const pauseFocusButton = document.getElementById("pause-focus-button");
    const unpauseFocusButton = document.getElementById("unpause-focus-button");
    if (status === 0) {
        startFocusButton.setAttribute("style", "display: block");
        pauseFocusButton.setAttribute("style", "display: none");
        unpauseFocusButton.setAttribute("style", "display: none");
        endFocusButton.setAttribute("style", "display: none");
    }
    if (status === 1)  {
        startFocusButton.setAttribute("style", "display: none");
        pauseFocusButton.setAttribute("style", "display: none");
        unpauseFocusButton.setAttribute("style", "display: block");
        endFocusButton.setAttribute("style", "display: block");
    }
    if (status === 2)  {
        startFocusButton.setAttribute("style", "display: none");
        pauseFocusButton.setAttribute("style", "display: block");
        unpauseFocusButton.setAttribute("style", "display: none");
        endFocusButton.setAttribute("style", "display: none");
    }
}
function displayFocusButtons() {

}
const highlightedTaskDiv = document.getElementById("highlighted-task-box");
async function highlightTask(taskId) {
    removeAllChildNodes(highlightedTaskDiv);
    highlightedTaskDiv.setAttribute("style", "visibility: visible");
    const taskHeader = document.createElement("p");
    taskHeader.setAttribute('id', 'highlighted-task-header');
    taskHeader.classList.add('highlighted-task-text');

    const taskDescription = document.createElement("p");
    taskDescription.setAttribute('id', 'highlighted-task-desc');
    taskDescription.classList.add('highlighted-task-text');

    const taskTime = document.createElement("p");
    taskTime.setAttribute('id', 'highlighted-task-time');
    taskTime.classList.add('highlighted-task-text');

    let task = await getTaskById(taskId); // THIS HAD TO BE DONE BECAUSE WE ARE PASSING INTO IT THE JSON AT THE START. SO THE DESC WASN'T BEING UPDATED UNTIL IT WE ADDED A NEW TASK.
    taskHeader.textContent = task["name"];
    taskDescription.textContent = task["description"];
    taskDescription.setAttribute("contenteditable", "true");
    taskHeader.setAttribute("contenteditable", "true");
    taskDescription.addEventListener("input", function () {
        console.log("Changing description");
        submitDescription(task["taskId"], taskDescription.textContent);
    }, false);
    taskHeader.addEventListener("input", async function () {
        console.log("Changing name");
        await changeTaskName(taskId, taskHeader.textContent).then(() => fetchTasks()).then((tasks) => displayTasks(tasks));
    }, false);
    taskTime.textContent = "Elapsed time: " + await displayTaskTime(task["taskId"]); // Should be a function for fancy displaying of time. 10s spent. 5mins spent. Based on how much time.+
    highlightedTaskDiv.appendChild(taskHeader);
    await setupFocusButtons(task);
    highlightedTaskDiv.appendChild(taskDescription);
    highlightedTaskDiv.appendChild(taskTime);
}
async function changeNameEventFunction(taskId, taskHeader) {
    console.log("Changing name");
    await changeTaskName(taskId, taskHeader.textContent).then(() => fetchTasks()).then((tasks) => displayTasks(tasks));

}
async function setupFocusButtons(task) {
    const startFocusButton = document.createElement("div");
    startFocusButton.setAttribute('id', "start-focus-button");
    startFocusButton.classList.add('focus-button');
    const pauseFocusButton = document.createElement("div");
    pauseFocusButton.setAttribute('id', "pause-focus-button");
    pauseFocusButton.classList.add('focus-button');
    const unpauseFocusButton = document.createElement("div");
    unpauseFocusButton.setAttribute('id', "unpause-focus-button");
    unpauseFocusButton.classList.add('focus-button');
    const endFocusButton = document.createElement("div");
    endFocusButton.setAttribute('id', "end-focus-button");
    endFocusButton.classList.add('focus-button');
    const focusButtons = document.getElementsByClassName('focus-button');
    for (let i = 0; i < focusButtons.length; i++) {
        highlightedTaskDiv.appendChild(focusButtons[i]);
    }
    highlightedTaskDiv.appendChild(startFocusButton);
    highlightedTaskDiv.appendChild(pauseFocusButton);
    highlightedTaskDiv.appendChild(unpauseFocusButton);
    highlightedTaskDiv.appendChild(endFocusButton);
    // Define a purpose for each button; for use in event listener function
    startFocusButton.purpose = "start";
    pauseFocusButton.purpose = "pause";
    unpauseFocusButton.purpose = "unpause";
    endFocusButton.purpose = "end";
    //
    startFocusButton.taskId = task["taskId"];
    pauseFocusButton.taskId = task["taskId"];
    unpauseFocusButton.taskId = task["taskId"];
    endFocusButton.taskId = task["taskId"];

    // Set text content for each button
    startFocusButton.textContent = `Start focus for ${focusDuration} minutes`;
    pauseFocusButton.textContent = "Pause";
    unpauseFocusButton.textContent = "Unpause";
    endFocusButton.textContent = "End focus";
    // Determine which buttons are displayed based on the running and active attributes of the task
    let taskRunning = await getTaskRunning(task["taskId"]);
    let taskActive = await getTaskActive(task["taskId"]);
    if (!taskActive && !taskRunning) {
        startFocusButton.setAttribute("style", "display: block");
        pauseFocusButton.setAttribute("style", "display: none");
        unpauseFocusButton.setAttribute("style", "display: none");
        endFocusButton.setAttribute("style", "display: none");
    }
    else if (taskActive && !taskRunning) {
        startFocusButton.setAttribute("style", "display: none");
        pauseFocusButton.setAttribute("style", "display: none");
        unpauseFocusButton.setAttribute("style", "display: block");
        endFocusButton.setAttribute("style", "display: block");
    }
    else if (taskRunning) {
        startFocusButton.setAttribute("style", "display: none");
        pauseFocusButton.setAttribute("style", "display: block");
        unpauseFocusButton.setAttribute("style", "display: none");
        endFocusButton.setAttribute("style", "display: none");
    }
    // Attach and detach event listeners
    let buttons = document.getElementsByClassName("focus-button");
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].getAttribute('listener') === 'true') {
            buttons[i].removeEventListener("click", buttonEventListenerFunction, false);
        }
        buttons[i].addEventListener("click", buttonEventListenerFunction, false);
        buttons[i].setAttribute('listener', 'true');
    }
    // startFocusButton.addEventListener("click", buttonEventListenerFunction, false);
    // pauseFocusButton.addEventListener("click", buttonEventListenerFunction, false);
    // unpauseFocusButton.addEventListener("click", buttonEventListenerFunction, false);
    // endFocusButton.addEventListener("click", buttonEventListenerFunction, false);
    // startFocusButton.setAttribute('listener', 'true');
    // pauseFocusButton.setAttribute('listener', 'true');
    // unpauseFocusButton.setAttribute('listener', 'true');
    // endFocusButton.setAttribute('listener', 'true');
}

function buttonEventListenerFunction(e) {
    let button = e.currentTarget;
    let purpose = button.purpose;
    console.log(`${purpose} button in highlighted box pressed`);
    if (purpose === "start") startTaskSession(button.taskId, 0, false);
    if (purpose === "pause") pauseTaskSession(button.taskId, 0, false);
    if (purpose === "unpause") unpauseTaskSession(button.taskId, 0, false);
    if (purpose === "end") {
        endTaskSession(button.taskId);
        highlightTask(button.taskId);
    }
}


// EXTREMELY INTERESTING. IN THIS APPROACH, THE BUTTONS YOU HAVE WILL KEEP ALL OLD EVENT LISTENERS THEY HAD!
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
        populateContextMenu(menuDiv, taskId);
    }, false);
}
function openContextMenu(e) {
    console.log("Opened context menu");
    e.preventDefault();
    const menuDiv = document.getElementById("context-menu");
    menuDiv.setAttribute("style", "visibility: visible");
    menuDiv.style.left = e.pageX +"px";
    menuDiv.style.top = e.pageY - 25 +"px";
}

async function populateContextMenu(menuDiv, taskId) {
    menuDiv.innerHTML = "";
    const startDiv = document.createElement("div");
    const pauseDiv = document.createElement("div");
    const unpauseDiv = document.createElement("div");
    const endDiv = document.createElement("div");
    const descDiv = document.createElement("div");
    const deleteDiv = document.createElement("div");
    startDiv.classList.add("menu-item", "pointer");
    pauseDiv.classList.add("menu-item", "pointer");
    startDiv.classList.add("menu-item", "pointer");
    unpauseDiv.classList.add("menu-item", "pointer");
    endDiv.classList.add("menu-item", "pointer");
    descDiv.classList.add("menu-item", "pointer");
    deleteDiv.classList.add("menu-item", "pointer");
    if (!await getTaskActive(taskId)) {
        pauseDiv.setAttribute("style", "display: none");
        unpauseDiv.setAttribute("style", "display: none");
        endDiv.setAttribute("style", "display: none");
    }
    else if (await getTaskRunning(taskId)) {
        startDiv.setAttribute("style", "display: none");
        unpauseDiv.setAttribute("style", "display: none");
        endDiv.setAttribute("style", "display: none");
    }
    else {
        startDiv.setAttribute("style", "display: none");
        pauseDiv.setAttribute("style", "display: none");
    }
    startDiv.addEventListener('click', function () {
        highlightTask(taskId);
        startTaskSession(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    pauseDiv.addEventListener('click', function () {
        highlightTask(taskId);
        pauseTaskSession(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    unpauseDiv.addEventListener('click', function () {
        highlightTask(taskId);
        unpauseTaskSession(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    endDiv.addEventListener('click', function () {
        highlightTask(taskId);
        endTaskSession(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    deleteDiv.addEventListener('click', function () {
        deleteTask(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })

    startDiv.textContent = "Start session";
    pauseDiv.textContent = "Pause session";
    unpauseDiv.textContent = "Unpause session";
    endDiv.textContent = "End session";
    descDiv.textContent = "Description";
    deleteDiv.textContent = "Delete";
    // let elements = document.getElementsByClassName("menu-item pointer");
    // console.log(elements.length)
    // for (let i = 0; i < elements.length; i++) {
    //     menuDiv.appendChild(elements[i]);
    // }
    menuDiv.appendChild(startDiv);
    menuDiv.appendChild(pauseDiv);
    menuDiv.appendChild(unpauseDiv);
    menuDiv.appendChild(endDiv);
    menuDiv.appendChild(descDiv);
    menuDiv.appendChild(deleteDiv);
}
function removeAllChildNodes(parent) {
    while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
    }
}
