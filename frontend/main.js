const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");
const PLAY_IMG = "images/play.png";
const PAUSE_IMG = "images/pause.png";
const DELETE_IMG = "images/close.png";
const DOTS_IMG = "images/dots.png";

window.onload = async function() {
    let taskElements = await fetchTasks();
    displayTasks(taskElements);
}

const inputForm=document.getElementById("task-input-form");
inputForm.addEventListener('submit', function(e) {
    console.log("Trying to submit eh?");
    e.preventDefault();
    createNewTask();
}, false);
document.addEventListener('click', function handleClickOutsideBox(event) {
    const highlightBox = document.getElementById("highlighted-task-div");
    const taskBox = document.getElementById("all-tasks-div");
    if (!highlightBox.contains(event.target) && !taskBox.contains(event.target)) highlightBox.style.visibility = 'hidden';
    if (!menuDiv.contains(event.target)) menuDiv.style.visibility = 'hidden';
});

const menuDiv = document.createElement("div");
menuDiv.classList.add("box");
menuDiv.classList.add("context-menu");
menuDiv.setAttribute("id", "context-menu");
const all = document.getElementById("all");
all.appendChild(menuDiv);


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



async function createTaskElement(taskJson) {
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
function addRightClickHandler(taskDiv, taskJson) {
    taskDiv.addEventListener('contextmenu', function(e) {
        console.log("Opened context menu");
        e.preventDefault();
        const menuDiv = document.getElementById("context-menu");
        menuDiv.setAttribute("style", "visibility: visible");
        menuDiv.style.left = e.pageX +"px";
        menuDiv.style.top = e.pageY - 25 +"px";
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
    taskHeader.textContent = taskJson["name"];
    taskDescription.classList.add("highlighted-task-desc");
    taskDescription.textContent = taskJson["description"];
    accumulatedTimeDiv.classList.add("highlighted-task-time");
    accumulatedTimeDiv.textContent = await displayTaskTime(taskJson["taskId"]); // Should be a function for fancy displaying of time. 10s spent. 5mins spent. Based on how much time.
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
    // let startButton = document.getElementById(getStartSessionButtonId(taskId));
    // let pauseButton = document.getElementById(getEndSessionButtonId(taskId));
    // setPlayPauseStatus(taskId, startButton, pauseButton);
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
async function setPlayPauseStatus(taskId, startButton, pauseButton) {
    if (await getTaskRunning(taskId)) {
        console.log("Pause appears, play disappears");
        startButton.setAttribute("style", "display: none");
        pauseButton.setAttribute("style", "display: block");
    }
    if (!await getTaskRunning(taskId)) {
        console.log("Play appears, pause disappears");
        startButton.setAttribute("style", "display: block");
        pauseButton.setAttribute("style", "display: none");
    }
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
async function getRequest(taskId, action) {
    return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
    })
}
async function postRequest(taskId, action) {
     return await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
        method: "POST",
    })
}

async function startTaskSession(taskId) {
    console.log("Starting task session");
    console.log(getStartSessionButtonId(taskId));
    // let startButton = document.getElementById(getStartSessionButtonId(taskId));
    // let pauseButton = document.getElementById(getEndSessionButtonId(taskId));
    // await setPlayPauseStatus(taskId, startButton, pauseButton);
    await postRequest(taskId, "start-session");
    startStopwatch();
}

async function endTaskSession(taskId) {
    console.log("Ending task session");
    // let startButton = document.getElementById(getStartSessionButtonId(taskId));
    // let pauseButton = document.getElementById(getEndSessionButtonId(taskId));
    // await setPlayPauseStatus(taskId, startButton, pauseButton);
    await postRequest(taskId, "end-session");
    //stopStopwatch(stopwatchInterval, startTime);
}

async function getTaskRunning(taskId) {
    let promise = await fetch(TASK_URL.concat(`/get-task-running/${taskId}`), { // `` makes something into a string
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
// 3. When you delete all tasks, there is an exception. NOT FIXED. HOW? 
// 4. Accumulated Time is only updated when you end a session. FIXED (because it's not a problem)
// 5. onsubmit through JS doesn't work. FIXED
// 6. Scrolling down to bottom of box crops last task a bit. FIXED
// 7. Create a separate box for timer.
// 8. Create a function for fancy display of accumulated time. DONE
// 9. Create a right click context menu for tasks. DONE
// 10. Pausing session doesn't update time immediately in highlight box. You have to highlight it again. FIXED
// 11. Starting a task will end all other tasks in the backend. But in the front end, the button will still change. And thus you will get an error for stopping an already stopped task.




let startTime; // to keep track of the start time
let elapsedPausedTime = 0;
function startStopwatch(stopwatchInterval) {
    let startTime = Date.now();
    stopwatchInterval = setInterval(updateStopwatch, 1000, startTime, "stopwatch");
}
function stopStopwatch(stopwatchInterval, startTime) {
    clearInterval(stopwatchInterval); // stop the interval
    elapsedPausedTime = new Date().getTime() - startTime; // calculate elapsed paused time
    stopwatchInterval = null; // reset the interval variable
}
function updateStopwatch(startTime, stopwatchId) {


    const currentTime = new Date().getTime(); // get current time in milliseconds
    const elapsedTime = currentTime - startTime; // calculate elapsed time in milliseconds
    const seconds = Math.floor(elapsedTime / 1000) % 60; // calculate seconds
    const minutes = Math.floor(elapsedTime / 1000 / 60) % 60; // calculate minutes
    const hours = Math.floor(elapsedTime / 1000 / 60 / 60); // calculate hours
     // format display time
    // document.getElementById(stopwatchId).textContent = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds); // update the display
}

async function getAccumulatedTime(taskId){
    let accTime =  await getRequest(taskId, "get-accumulated-time");
    return accTime.json();
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
    const startButton = document.getElementById(getStartSessionButtonId(taskId));
    const endButton = document.getElementById(getEndSessionButtonId(taskId));
    if (await getTaskRunning(taskId)) {
        startDiv.setAttribute("style", "display: none");
    }
    if (!await getTaskRunning(taskId)) {
        endDiv.setAttribute("style", "display: none");
    }
    startDiv.addEventListener('click', function () {
        startTaskSession(taskId);
        startButton.setAttribute("style", "display: none");
        endButton.setAttribute("style", "display: block");
        menuDiv.setAttribute("style", "visibility: hidden");
    })
    endDiv.addEventListener('click', function () {
        endTaskSession(taskId);
        startButton.setAttribute("style", "display: block");
        endButton.setAttribute("style", "display: none");
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