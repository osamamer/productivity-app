"use strict" // strict mode
const ROOT_URL = "http://localhost:8080";
const TASK_URL = ROOT_URL.concat("/api/v1/task");

import {createTaskElement, highlightTask, setupHighPriorityTaskBox} from './tasks';
import {
    endAllSessions, getAllTasks,
    getDayPlan, getTasks,
    getToday,
    getTodayRating,
    setDayPlan,
    setDaySummary,
    setTodayRating, createTask, setTodayInfo
} from './backend-calls';
// npm run build
window.onload = async function() {
    let taskElements = await fetchTasks(todayDate, true);
    // let taskElements = await fetchAllTasks();
    displayTasks(taskElements);
    await displayTodayRating();
    await setupDayBox();
    await endAllSessions();
    console.log(new Date().getDate())
    await setupHighPriorityTaskBox();
}

const todayDate = getCurrentDateFormatted();
const menuDiv = document.getElementById("task-context-menu");
const taskInputForm= document.getElementById("task-input-form");
const dayButton = document.getElementById("sun-image");
const dayModal = document.getElementById("day-modal");
const addTaskButton = document.getElementById("add-task-button");
const createTaskModal = document.getElementById("create-task-modal");
const createTaskForm = document.getElementById("create-new-task-form");
const dayInputForm = document.getElementById("day-input-form");
dayButton.addEventListener('click', () => {
    dayModal.show();
})
addTaskButton.addEventListener('click',  () => {
    createTaskModal.show();
})
document.addEventListener('click', function handleClickOutsidePopups(event) {
    if (!menuDiv.contains(event.target)) menuDiv.style.visibility = 'hidden';
    if (!dayModal.contains(event.target) && !   dayButton.contains(event.target)) dayModal.close();
    if (!createTaskModal.contains(event.target) && !addTaskButton.contains(event.target)) createTaskModal.close();
});
taskInputForm.addEventListener('submit', function(e) {
    console.log("Submitting new task.");
    e.preventDefault();
    createTaskFromInputField();
}, false);
dayInputForm.addEventListener('submit', function(e) {
    console.log("Submitting day information.");
    const rating = document.getElementById('day-rating-input-field').value;
    const plan = document.getElementById('day-plan-input-field').value;
    const summary = document.getElementById('day-summary-input-field').value;
    setTodayInfo(rating, plan, summary)
        .then(() => displayTodayRating())
        .then(() => setupDayBox());
})
createTaskForm.addEventListener('submit', function (e) {
    console.log("Submitting task information.");
    const name = document.getElementById('task-name-input-field').value;
    const description = document.getElementById('task-desc-input-field').value;
    const scheduledTime = document.getElementById('task-scheduled-input-field').value;
    const tag = document.getElementById('task-tag-input-field').value;
    const importance = document.getElementById('task-importance-input-field').value;
    createTask(name, description, scheduledTime, tag, importance)
        .then(() => fetchTodayNonCompletedTasks())
        .then((tasksString) => displayTasks(tasksString))
        .then(() => setupHighPriorityTaskBox());
})

export async function fetchTasks(date, nonCompletedOnly) {
    const responseJson = await getTasks(date, nonCompletedOnly);
    let taskElements = [];
    if (responseJson.length === 0) return taskElements;
    for (let i = responseJson.length - 1; i >= 0; i--) {
        let taskElement = await createTaskElement(responseJson[i]);
        taskElements.push(taskElement);
    }
    await highlightTask(responseJson[responseJson.length-1]['taskId']);
    return taskElements;
}
export async function fetchTodayNonCompletedTasks() {
    return fetchTasks(todayDate, true);
}
export async function fetchAllTasks () {
    // const response = await fetch('http://localhost:8080/api/v1/task');
    // const responseJson = await response.json();
    const responseJson = await getAllTasks();
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
    let taskBox = document.getElementById("all-tasks-div")
    taskBox.innerHTML = "";
    const p = document.querySelector('.tasks-container');
    for (let i = 0; i < taskElements.length; i++) {
        document.querySelector('.tasks-container').appendChild(taskElements[i]);
        // if (taskElements[i]['completed'] === false) {
        //     document.querySelector('.tasks-container').appendChild(taskElements[i]);
        // }
    }
}
async function createTaskFromInputField (){
    const userTaskName = document.getElementById("task-input-field").value;
    if (userTaskName.trim() === "") return;
    document.getElementById("task-input-field").value = "";
    console.log("Creating task: " + userTaskName);
    await createTask(userTaskName, "", "", "", 0)
        .then(() => fetchTodayNonCompletedTasks())
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
export function getCurrentDateFormatted() {
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
    await createAndAppendChild('day-box-header', 'Today', false, null, ['box-header'], dayBox);
    await createAndAppendChild('day-box-rating', 'Today\'s rating: ' , true, getTodayRating(), ['highlighted-task-text', 'day-text'], dayBox);
    await createAndAppendChild('day-box-plan', 'The plan for today: ', true, getTodayPlan(), ['highlighted-task-text', 'day-text'], dayBox);
    await createAndAppendChild('day-box-summary', 'What ended up happening today: ', true, getTodaySummary(), ['highlighted-task-text', 'day-text'], dayBox);
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
// 11. Implement Pomodoro shit
// 12. IMPLEMENT POMO SHIT IN BACKEND!
// 13. Make paths. Like you have writing, productivity app, unity, whatever else. These are all paths.
// Visualize them. And make tasks have paths associated with them. And then when you complete a task that furthers the path.
// I think that's really cool and actually helpful.
// 14. Make the battery thing. Negative energy, positive energy, and measure that shit using your own app. To keep track and understand yourself better.
