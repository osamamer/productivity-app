const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

import {createTaskElement, highlightTask} from './tasks';
import {
    endAllSessions,
    getDayPlan,
    getToday,
    getTodayRating,
    setDayPlan,
    setDaySummary,
    setTodayRating
} from './backend-calls';
// npm run build
window.onload = async function() {
    let taskElements = await fetchTasks();
    displayTasks(taskElements);
    await displayTodayRating();
    await setupDayBox();
    await endAllSessions();
    console.log(document.location.href)

}


const menuDiv = document.getElementById("task-context-menu");
const taskInputForm= document.getElementById("task-input-form");
const dayButton = document.getElementById("sun-image");
const dayModal = document.getElementById("day-modal");
const dayInputForm = document.getElementById("day-input-form")
dayButton.addEventListener('click', () => {
    dayModal.show();
})
document.addEventListener('click', function handleClickOutsidePopups(event) {
    if (!menuDiv.contains(event.target)) menuDiv.style.visibility = 'hidden';
    if (!dayModal.contains(event.target) && !   dayButton.contains(event.target)) dayModal.close();
});
// alert("hello!");
// document.getElementById('tasks-page').onload = async function() {
//     alert("hello!");
//
// }
// if (window.location.href.match('task-page.html')) {
//     alert("hellooo!");
//
// }
// document.onload = async function() {
//     alert("yo")
// }
taskInputForm.addEventListener('submit', function(e) {
    console.log("Submitting new task.");
    e.preventDefault();
    createNewTask();
}, false);
dayInputForm.addEventListener('submit', function(e) {
    console.log("Submitting day information.");
    setTodaySummaryFromForm();
    setTodayPlanFromForm();
    setTodayRatingFromForm().then(r => displayTodayRating());
    setupDayBox();
})
export async function fetchTasks () {
    const response = await fetch('http://localhost:8080/api/v1/task');
    const responseJson = await response.json();
    let taskElements = [];
    if (responseJson.length === 0) return taskElements;
    for (let i = responseJson.length - 1; i >= 0; i--) {
        let taskElement = await createTaskElement(responseJson[i]);
        taskElements.push(taskElement);
    }
    await highlightTask(responseJson[responseJson.length-1]['taskId']);
    return taskElements;
}
export function displayTasks (taskElements) {
    document.getElementById("all-tasks-div").innerHTML = "";
    const p = document.querySelector('.tasks-container');
    for (let i = 0; i < taskElements.length; i++) {
        document.querySelector('.tasks-container').appendChild(taskElements[i]);
        // if (taskElements[i]['completed'] === false) {
        //     document.querySelector('.tasks-container').appendChild(taskElements[i]);
        // }
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
            taskDescription: "Description"
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        }
    })
        .then(() => fetchTasks())
        .then((tasksString) => displayTasks(tasksString))
}

async function displayTodayRating() {
    const dayDiv = document.getElementById("day-div");
    const dayRating = await getTodayRating();
    dayDiv.textContent = `Today's been a ${dayRating}`
    console.log(await getTodayRating());
    //dayDiv.textContent = "HUH"
}
async function setTodayRatingFromForm() {
    const userDayRating = document.getElementById("day-rating-input-field").value;
    await setTodayRating(userDayRating);
}
async function setTodaySummaryFromForm() {
    const userDaySummary = document.getElementById("day-summary-input-field").value;
    console.log(userDaySummary)
    const todayDate = getCurrentDateFormatted();
    console.log(todayDate)
    await setDaySummary(todayDate, userDaySummary);
}
async function setTodayPlanFromForm() {
    const userDayPlan = document.getElementById("day-plan-input-field").value;
    const todayDate = getCurrentDateFormatted();
    await setDayPlan(todayDate, userDayPlan);
}
function getCurrentDateFormatted() {
    const date = new Date();
    const year = date.getFullYear();
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const day = `0${date.getDate()}`.slice(-2);
    return `${year}-${month}-${day}`;
}
function formatDate(date) {
    const year = date.getFullYear();
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const day = `0${date.getDate()}`.slice(-2);
    return `${year}-${month}-${day}`;
}
async function setupDayBox() {
    const dayBox = document.getElementById('day-box');
    dayBox.innerHTML = "";
    await createAndAppendChild('day-box-header', 'Today (Abridged)', false, null, ['highlighted-task-text'], dayBox);
    await createAndAppendChild('day-box-rating', 'Today\'s rating: ' , true, getTodayRating(), ['highlighted-task-text'], dayBox);
    await createAndAppendChild('day-box-plan', 'The plan for today: ', true, getTodayPlan(), ['highlighted-task-text'], dayBox);
    await createAndAppendChild('day-box-summary', 'What ended up happening today: ', true, getTodaySummary(), ['highlighted-task-text'], dayBox);
}
export async function createAndAppendChild(id, text, requiresFunction, textFunction, classes, parent) {
    const createdElement = document.createElement("div");
    if (requiresFunction) {
        createdElement.textContent = text + await textFunction; // what if function is not async?
    }
    else {
        createdElement.textContent = text;
    }
    if (id) createdElement.setAttribute('id', id);
    createdElement.classList.add(...classes);
    parent.appendChild(createdElement);
    return createdElement;
}
async function getTodaySummary() {
    let today = await  getToday();
    return today['summary'];
}
async function getTodayPlan() {
    let today = await  getToday();
    return today['plan'];
}


//  TODO List:
// 1. Finish day box
// 2. Fix wrap then stretch problem. DONE
// 3. Give max height to task div in task box. DONE
// 4. Fix code. Make functions. DONE
// 5. Buttons in task div problem. The start button always starts, should call unpause when the task is paused instead of start.
// 6. Make new task appear at top of list. DONE
// 7. Need to create a function for the description in the context menu. Some sort of popup.
// 8. Make task list drag-and-droppable.
// 9. Add lists to tasks.
// 10. Slightly fix button functions.
