import {
    getTaskRunning,
    deleteTask,
    postRequest,
    getTaskById,
    submitDescription,
    getAccumulatedTime,
    getTaskActive
} from './backend-calls'
import {
    createStartSessionButtons,
    createPauseSessionButton,
    createDeleteTaskButton,
    getStartSessionButtonId, getEndSessionButtonId
} from './buttons';

document.addEventListener('click', function handleClickOutsideBox(event) {
    const highlightBox = document.getElementById("highlighted-task-div");
    const taskBox = document.getElementById("all-tasks-div");
    //if (!highlightBox.contains(event.target) && !taskBox.contains(event.target) && !menuDiv.contains(event.target)) highlightBox.style.visibility = 'hidden';
    if (!menuDiv.contains(event.target)) menuDiv.style.visibility = 'hidden';
});

const menuDiv = document.createElement("div");
menuDiv.classList.add("box");
menuDiv.classList.add("context-menu");
menuDiv.setAttribute("id", "context-menu");
const all = document.getElementById("all");
all.appendChild(menuDiv);
let focusDuration = 30;
export async function createTaskElement(taskJson) {
    let taskId = taskJson["taskId"];
    const taskDiv = document.createElement("div");
    const taskHeader = document.createElement("p");
    taskDiv.classList.add("task-div");
    taskDiv.setAttribute("id", taskId);
    taskHeader.classList.add("task-text");
    taskHeader.textContent = taskJson["name"];
    const startButton = await createStartSessionButtons(taskJson);
    const endButton = await createPauseSessionButton(taskJson);
    taskDiv.appendChild(taskHeader);
    taskDiv.appendChild(startButton);
    taskDiv.appendChild(endButton);
    taskDiv.appendChild(createDeleteTaskButton(taskJson));
    taskDiv.addEventListener('click', function(){
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
    document.getElementById("timer-div").textContent = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds); // update the display
}
function clearStopwatch() {
    totalElapsedTime = -1000;
    updateStopwatch();
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
async function highlightTask(taskId) {
    const highlightedTaskDiv = document.getElementById("highlighted-task-div");
    highlightedTaskDiv.setAttribute("style", "visibility: visible");
    const taskHeader = document.getElementById("highlighted-task-header");
    const taskDescription = document.getElementById("highlighted-task-desc");
    const accumulatedTimeDiv = document.getElementById("highlighted-task-time");
    let task = await getTaskById(taskId); // THIS HAD TO BE DONE BECAUSE WE ARE PASSING INTO IT THE JSON AT THE START. SO THE DESC WASN'T BEING UPDATED UNTIL IT WE ADDED A NEW TASK.
    taskHeader.textContent = task["name"];
    taskDescription.textContent = task["description"];
    taskDescription.setAttribute("contenteditable", "true");
    taskDescription.addEventListener("input", function () {
        console.log("Changing description");
        submitDescription(task["taskId"], taskDescription.textContent);
    }, false);
    accumulatedTimeDiv.textContent = "Elapsed time: " + await displayTaskTime(task["taskId"]); // Should be a function for fancy displaying of time. 10s spent. 5mins spent. Based on how much time.+
    setupFocusButtons(task);
}
async function setupFocusButtons(task) {
    let startFocusButton = document.getElementById("start-focus-button");
    let pauseFocusButton = document.getElementById("pause-focus-button");
    let unpauseFocusButton = document.getElementById("unpause-focus-button");
    let endFocusButton = document.getElementById("end-focus-button");
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
    console.log("Active: " + taskActive + ", " + "Running: " + taskRunning);
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
    // let button = document.getElementById(`${purpose}-focus-button`);
    console.log(`${purpose} button in highlighted box pressed`);
    let functionName = purpose + "TaskSession";
    if (purpose === "start") startTaskSession(button.taskId, 0, false);
    if (purpose === "pause") pauseTaskSession(button.taskId, 0, false);
    if (purpose === "unpause") unpauseTaskSession(button.taskId, 0, false);
    if (purpose === "end") {
        endTaskSession(button.taskId);
        highlightTask(button.taskId);
    }
}

function executeFunctionByName(functionName, context , args ) {
     args = Array.prototype.slice.call(arguments, 2);
    var namespaces = functionName.split(".");
    var func = namespaces.pop();
    for (var i = 0; i < namespaces.length; i++) {
        context = context[namespaces[i]];
    }
    return context[func].apply(context, args);
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
    const endDiv = document.createElement("div");
    const descDiv = document.createElement("div");
    const deleteDiv = document.createElement("div");
    startDiv.classList.add("menu-item", "pointer");
    endDiv.classList.add("menu-item", "pointer");
    descDiv.classList.add("menu-item", "pointer");
    deleteDiv.classList.add("menu-item", "pointer");
    if (await getTaskRunning(taskId)) {
        startDiv.setAttribute("style", "display: none");
    }
    if (!await getTaskRunning(taskId)) {
        endDiv.setAttribute("style", "display: none");
    }
    startDiv.addEventListener('click', function () {
        startTaskSession(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    endDiv.addEventListener('click', function () {
        endTaskSession(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    deleteDiv.addEventListener('click', function () {
        deleteTask(taskId);
        menuDiv.setAttribute("style", "visibility: hidden");
    })

    startDiv.textContent = "Start";
    endDiv.textContent = "End";
    descDiv.textContent = "Description";
    deleteDiv.textContent = "Delete";
    menuDiv.appendChild(startDiv);
    menuDiv.appendChild(endDiv);
    menuDiv.appendChild(descDiv);
    menuDiv.appendChild(deleteDiv);
}