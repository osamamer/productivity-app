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

function createStartSessionButton(taskJson) {
    const button = document.createElement("img");
    button.classList.add("start-task-button");
    const taskId = taskJson["taskId"];
    button.textContent = "Start session";
    button.setAttribute("id", getStartSessionButtonId(taskId));
    button.onclick = async (ev) => {
        await startTaskSession(taskId);
        button.setAttribute("style", "display: none");
        document.getElementById(getEndSessionButtonId(taskId)).setAttribute("style", "display: block");
    }
    return button;
}
function createEndSessionButton(taskJson) {
    const button = document.createElement("img");
    button.classList.add("end-task-button");
    button.setAttribute("style", "display: none");
    button.textContent = "End session";
    const taskId = taskJson["taskId"];
    button.setAttribute("id", getEndSessionButtonId(taskId));
    button.onclick = async (ev) => {
        await endTaskSession(taskId);
        button.setAttribute("style", "display: none");
        document.getElementById(getStartSessionButtonId(taskId)).setAttribute("style", "display: block");
    }
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


