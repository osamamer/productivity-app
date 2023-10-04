const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");
const PLAY_IMG = "images/play.png";
const PAUSE_IMG = "images/pause.png";
const DELETE_IMG = "images/close.png";
const DOTS_IMG = "images/dots.png";

const inputField=document.getElementById("task-input-field");

function stopFormSubmit(event) {
    console.log("Trying to prevent default");
    event.preventDefault();
}
inputField.addEventListener('submit', function (){
    stopFormSubmit(event);
    createNewTask();
});

window.onload = async function() {
    let taskElements = await fetchTasks();
    displayTasks(taskElements);
}
async function fetchTasks () {
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
function displayTasks (taskElements) {
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
            taskDescription: "A user-submitted task"
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}

function highlightTask(taskJson) {
    const highlightedTaskDiv = document.getElementById("highlighted-task-div");
    while (highlightedTaskDiv.firstChild) {
        highlightedTaskDiv.removeChild(highlightedTaskDiv.lastChild);
    }
    highlightedTaskDiv.setAttribute("style", "display: block");
    const highLightedTaskHeader = document.createElement("div");
    highlightedTaskDiv.appendChild(highLightedTaskHeader);
    highLightedTaskHeader.classList.add("task-text");
    highLightedTaskHeader.textContent = taskJson["name"];
}

async function createTaskElement(taskJson) {
    const taskDiv = document.createElement("div");
    const taskHeader = document.createElement("p");
    taskDiv.classList.add("task-div");
    taskHeader.classList.add("task-text");
    //document.getElementById("bulk-tasks").appendChild(taskDiv); // Makes everything disappear for some reason. Maybe because bulk-tasks is a class not an id, idiot.
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
    return taskDiv;
}
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
        button.setAttribute("style", "display: none");
        document.getElementById(otherButtonIdSupplier(taskId)).setAttribute("style", "display: block");
    }
    return button;
}



// Making this into an async function breaks everything. Because then you can't pass it into the append child method. It wants an HTMLImageElement NOT a promise of one. So I added await.
async function createStartSessionButton(taskJson) {
    let button = createTaskActionButton("start", taskJson, getStartSessionButtonId, getEndSessionButtonId, startTaskSession, PLAY_IMG);
    if (await getTaskRunning(taskJson["taskId"].toString())) {
        button.setAttribute("style", "display: none");
    }
    return button;
}


 async function createEndSessionButton(taskJson) {
    let button = createTaskActionButton("end", taskJson, getEndSessionButtonId, getStartSessionButtonId, endTaskSession, PAUSE_IMG);
    if (!await getTaskRunning(taskJson["taskId"].toString())) {
        button.setAttribute("style", "display: none");
    }
        return button;
}

function createDeleteTaskButton(taskJson) {
    return createTaskActionButton("delete", taskJson, getDeleteTaskButtonId, getDeleteTaskButtonId, deleteTask, DELETE_IMG);
}

function getButtonId(taskId, buttonAction) {
    return `${buttonAction}-button-${taskId}`;
}

function getStartSessionButtonId(taskId) {
    return getButtonId(taskId, "start-session");
}

function getEndSessionButtonId(taskId) {
    return getButtonId(taskId, "end-session");
}

function getDeleteTaskButtonId(taskId) {
    getButtonId(taskId, "delete-task");

}

async function performTaskAction(taskId, action) {
     return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
        method: "POST",
    })
}

async function startTaskSession(taskId) {
    console.log("Starting task session");
    await performTaskAction(taskId, "start-session");
}

async function endTaskSession(taskId) {
    console.log("Ending task session");

    await performTaskAction(taskId, "end-session");
}

async function getTaskRunning(taskId) {
    let promise = await fetch(TASK_URL.concat(`/get-task-running/${taskId}`), { // `` makes something into a string
        method: "POST",
    })
    return await promise.json();
}

async function deleteTask(taskId) {
    await fetch(TASK_URL.concat(`/${taskId}`), { // `` makes something into a string
        method: "DELETE",
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}

// TODO
// Bugs to fix:
// 1. Creating a new task switches a running task's button back to start. FIXED
// 2. Can enter an empty task. FIXED
// 3. When you delete all tasks, there is an exception.
// 4. Accumulated Time is only updated when you end a session.
// 5. onsubmit through JS doesn't work.
// 6. Scrolling down to bottom of box crops last task a bit.


// function timer() {
//
// }
// let time = setInterval(updateStopwatch, 1000);
//
// let startTime; // to keep track of the start time
// let stopwatchInterval; // to keep track of the interval
// let elapsedPausedTime = 0;
// function startStopwatch() {
//     let startTime = Date.now();
//     setInterval(updateStopwatch, 1000, startTime);
// }
// function stopStopwatch(stopwatchInterval, startTime) {
//     clearInterval(stopwatchInterval); // stop the interval
//     elapsedPausedTime = new Date().getTime() - startTime; // calculate elapsed paused time
//     stopwatchInterval = null; // reset the interval variable
// }
// function updateStopwatch(startTime) {
//     function pad(number) {
//         // add a leading zero if the number is less than 10
//         return (number < 10 ? "0" : "") + number;
//     }
//     const currentTime = new Date().getTime(); // get current time in milliseconds
//     const elapsedTime = currentTime - startTime; // calculate elapsed time in milliseconds
//     const seconds = Math.floor(elapsedTime / 1000) % 60; // calculate seconds
//     const minutes = Math.floor(elapsedTime / 1000 / 60) % 60; // calculate minutes
//     const hours = Math.floor(elapsedTime / 1000 / 60 / 60); // calculate hours
//      // format display time
//     document.getElementById("stopwatch").innerHTML = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds); // update the display
// }

