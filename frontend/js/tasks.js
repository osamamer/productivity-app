import {getTaskRunning, deleteTask, postRequest, getTaskById, submitDescription, getAccumulatedTime} from './backend-calls'
import {
    createStartSessionButton,
    createEndSessionButton,
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

export async function createTaskElement(taskJson) {
    const taskDiv = document.createElement("div");
    const taskHeader = document.createElement("p");
    taskDiv.classList.add("task-div");
    taskDiv.setAttribute("id", taskJson["taskId"]);
    taskHeader.classList.add("task-text");
    taskHeader.textContent = taskJson["name"];
    const startButton = await createStartSessionButton(taskJson);
    const endButton = await createEndSessionButton(taskJson);
    taskDiv.appendChild(taskHeader);
    taskDiv.appendChild(startButton);
    taskDiv.appendChild(endButton);
    taskDiv.appendChild(createDeleteTaskButton(taskJson));
    taskDiv.addEventListener('click', function(){
        highlightTask(taskJson);
    });
    addRightClickHandler(taskDiv, taskJson);
    return taskDiv;
}
export async function startTaskSession(taskId) {
    const tasks = await fetch('http://localhost:8080/api/v1/task');
    const tasksResponse = await tasks.json();
    for (let i = 0; i < tasksResponse.length; i++) {
        if (tasksResponse[i]["taskId"] !== taskId && await getTaskRunning(tasksResponse[i]["taskId"])) {
            console.log("Cannot start task because other task is running")
            return;
        }
    }
    console.log("Starting task session");
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    await postRequest(taskId, "start-session");
    switchPlayPause(buttonId, otherButtonId, taskId);
    startStopwatch();
}
export async function pauseTaskSession(taskId) {
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    stopStopwatch(intervalId);
    await postRequest(taskId, "pause-session");
    switchPlayPause(buttonId, otherButtonId, taskId);
}
export async function unpauseTaskSession(taskId) {
    const buttonId = getStartSessionButtonId(taskId);
    const otherButtonId = getEndSessionButtonId(taskId);
    stopStopwatch(intervalId);
    await postRequest(taskId, "unpause-session");
    switchPlayPause(buttonId, otherButtonId, taskId);
}
export async function endTaskSession(taskId) {
    const buttonId = getEndSessionButtonId(taskId);
    const otherButtonId = getStartSessionButtonId(taskId);
    console.log("Ending task session");
    switchPlayPause(buttonId, otherButtonId, taskId);
    stopStopwatch(intervalId);
    await postRequest(taskId, "end-session");
}
let intervalId;
let totalElapsedTime = 0;
function startStopwatch() {
    let startTime = Date.now();
    intervalId = setInterval(function () {
        updateStopwatch(startTime);
    }, 1000);
}
function stopStopwatch() {
    console.log(intervalId)
    clearInterval(intervalId); // stop the interval
    // stopwatchInterval = null; // reset the interval variable
}
function updateStopwatch(startTime) {
    const currentTime = new Date().getTime(); // get current time in milliseconds
    const elapsedTime = currentTime - startTime; // calculate elapsed time in milliseconds
    totalElapsedTime += 1000;
    const seconds = Math.floor(totalElapsedTime / 1000) % 60; // calculate seconds
    const minutes = Math.floor(totalElapsedTime / 1000 / 60) % 60; // calculate minutes
    const hours = Math.floor(totalElapsedTime / 1000 / 60 / 60); // calculate hours
    document.getElementById("timer-div").textContent = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds); // update the display
}
function switchPlayPause(buttonId, otherButtonId, taskId) {
    const button = document.getElementById(buttonId);
    const otherButton = document.getElementById(otherButtonId);
    button.setAttribute("style", "display: none");
    otherButton.setAttribute("style", "display: block");
}
async function highlightTask(taskJson) {
    const highlightedTaskDiv = document.getElementById("highlighted-task-div");
    while (highlightedTaskDiv.firstChild) {
        highlightedTaskDiv.removeChild(highlightedTaskDiv.lastChild);
    }
    highlightedTaskDiv.setAttribute("style", "visibility: visible");
    const taskHeader = document.createElement("p");
    const taskDescription = document.createElement("p");
    const accumulatedTimeDiv = document.createElement("p");
    highlightedTaskDiv.appendChild(taskHeader);
    highlightedTaskDiv.appendChild(taskDescription);
    highlightedTaskDiv.appendChild(accumulatedTimeDiv);
    taskHeader.classList.add("highlighted-task-text");
    let task = await getTaskById(taskJson["taskId"]); // THIS HAD TO BE DONE BECAUSE WE ARE PASSING INTO IT THE JSON AT THE START. SO THE DESC WASN'T BEING UPDATED UNTIL IT WE ADDED A NEW TASK.
    taskHeader.textContent = task["name"];
    taskDescription.classList.add("highlighted-task-desc");
    taskDescription.textContent = task["description"];
    taskDescription.setAttribute("contenteditable", "true");
    taskDescription.addEventListener("input", function() {
        console.log("Changing description");
        submitDescription(task["taskId"], taskDescription.textContent);
    }, false);
    accumulatedTimeDiv.classList.add("highlighted-task-time");
    accumulatedTimeDiv.textContent = "Elapsed time: " + await displayTaskTime(taskJson["taskId"]); // Should be a function for fancy displaying of time. 10s spent. 5mins spent. Based on how much time.
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