const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

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
            taskDescription: "A user submitted task"
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
    taskDiv.classList.add("task-div");
    const taskHeader = document.createElement("p");
    taskHeader.textContent = taskJson["name"];
    taskDiv.appendChild(taskHeader);
    taskDiv.appendChild(createStartSessionButton(taskJson));
    taskDiv.appendChild(createEndSessionButton(taskJson));
    return taskDiv;
}
function createSessionActionButton(action, taskJson, idSupplier, otherButtonIdSupplier, sessionFunction) {
    const button = document.createElement("button");
    button.classList.add(`${action}-task-button`);
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
    return createSessionActionButton("start", taskJson, getStartSessionButtonId, getEndSessionButtonId, startTaskSession);
}
function createEndSessionButton(taskJson) {
    let button = createSessionActionButton("end", taskJson, getEndSessionButtonId, getStartSessionButtonId, endTaskSession);
    button.setAttribute("style", "display: none");
    return button;
}
function getStartSessionButtonId(taskId) {
    return `start-session-button-${taskId}`
}
function getEndSessionButtonId(taskId) {
    return `end-session-button-${taskId}`
}
async function performTaskAction(taskId, action) {
    await fetch(TASK_URL.concat(`/${action}/${taskId}`), { // `` makes something into a string
        method: "POST",
    })
}
async function startTaskSession(taskId) {
    await performTaskAction(taskId, "start-session");
}

async function endTaskSession(taskId) {
    await performTaskAction(taskId, "end-session");
}


// Bugs to fix:
// 1. Creating a new task switches a running task's button back to start.
// 2. Can enter an empty task.



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


