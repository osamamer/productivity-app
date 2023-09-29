window.onload = function() {
    fetchTasks();
    displayTasks();
}
let taskText = "";

// Without this it doesn't get called
async function fetchTasks () {
    const response = await fetch('http://localhost:8080/api/v1/task');
    taskText = "";
    response.json().then((promiseJson) => {
        const responseObject = promiseJson; // It's already a JSON. YOU don't need to parse it. You only parse it if it's not already a JSON, if it's a string, and you want to turn it into JSON.
        for (let i = 0; i < responseObject.length; i++) {
            let task = responseObject[i];
            //taskText += `<li> ${task["name"]} </li>`; // `` makes something into a string
            displayTask(task);
            console.log(taskText);

        }
        displayTasks();
    });
}

 async function createNewTask (){
    //e.preventDefault();
    const userTaskName = document.getElementById("task-input-field").value;
     document.getElementById("task-input-field").value = "";
    console.log(userTaskName);
    await fetch('http://localhost:8080/api/v1/task', {
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
        .then(() => displayTasks())
}
 function displayTasks () {
    document.getElementById("all-tasks-p").innerHTML = taskText;
}

async function createNewTaskButton (){
    await fetch('http://localhost:8080/api/v1/task', {
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
        .then(() => displayTasks())
}
async function startTaskSession(taskId) {
    await fetch(`http://localhost:8080/api/v1/task"/start-session${taskId}`, {
        method: "POST",
    })
}

function displayTask(task) {
    
}