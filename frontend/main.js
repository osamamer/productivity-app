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
async function fetchTasks () {
    const response = await fetch('http://localhost:8080/api/v1/task');
    const responseJson = await response.json();
    let taskElements = [];
    for (let i = 0; i < responseJson.length; i++) {
        let taskElement = createTaskElement(responseJson[i]);
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
    document.getElementById("task-input-field").value = "";
    console.log(userTaskName);
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
function createTaskElement(taskJson) {
    const taskDiv =  document.createElement("div");
    const taskHeader = document.createElement("p");
    taskDiv.classList.add("task-div");
    //document.getElementById("bulk-tasks").appendChild(taskDiv); // Makes everything disappear for some reason. Maybe because bulk-tasks is a class not an id, idiot.
    taskHeader.textContent = taskJson["name"];
    taskDiv.appendChild(taskHeader);
    taskDiv.appendChild(createStartSessionButton(taskJson));
    taskDiv.appendChild(createEndSessionButton(taskJson));
    taskDiv.appendChild(createDeleteTaskButton(taskJson));
    return taskDiv;
}
function createTaskActionButton(action, taskJson, idSupplier, otherButtonIdSupplier, sessionFunction, buttonImage) {
    const button = document.createElement("img");
    button.src = buttonImage;
    button.classList.add(`${action}-task-button`);
    button.classList.add("pointer");
    const taskId = taskJson["taskId"];
    button.textContent = `${action} session`;
    button.setAttribute("id", idSupplier(taskId));
    button.onclick = async (ev) => {
        await sessionFunction(taskId);
        button.setAttribute("style", "display: none");
        document.getElementById(otherButtonIdSupplier(taskId)).setAttribute("style", "display: block");
    }
    return button;
}



function createStartSessionButton(taskJson) {
    return createTaskActionButton("start", taskJson, getStartSessionButtonId, getEndSessionButtonId, startTaskSession, PLAY_IMG);
}


function createEndSessionButton(taskJson) {
    let button = createTaskActionButton("end", taskJson, getEndSessionButtonId, getStartSessionButtonId, endTaskSession, PAUSE_IMG);
    button.setAttribute("style", "display: none");
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
    await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
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
async function deleteTask(taskId) {
    await fetch(TASK_URL.concat(`/${taskId}`), { // `` makes something into a string
        method: "DELETE",
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}

// Bugs to fix:
// 1. Creating a new task switches a running task's button back to start.
// 2. Can enter an empty task.
// 3. When you delete all tasks, there is an exception.



// FUNCTIONS BELOW ARE DEPRECATED!
async function createNewTaskButton (){
    await fetch(TASK_URL, {
        method: "POST",
        body: JSON.stringify({
            taskName: "userTaskName",
            taskDescription: "A user submitted task"
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}


