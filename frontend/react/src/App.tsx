import React, {useEffect, useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import {Task} from "./interfaces/Task.tsx";
import {TaskList} from "./components/TaskList.tsx";
import {DayEntity} from "./interfaces/DayEntity.tsx";
import {TodayBox} from "./components/TodayBox.tsx";
// import '../../styles.css';
import {TaskBox} from "./components/TaskBox.tsx";
import Home from './images/home.png';
import {CreateTaskModal} from "./components/CreateTaskModal.tsx";
import {HighlightedTaskBox} from "./components/HighlightedTaskBox.tsx";
import {HighestPriorityTaskBox} from "./components/HighestPriorityTaskBox.tsx";
import {Timer} from "./components/Timer.tsx";
import {Header} from "./components/Header.tsx";
import {DayModal} from "./components/DayModal.tsx";
import {SideNav} from "./components/SideNav.tsx";
import {TaskToCreate} from "./interfaces/TaskToCreate.tsx";

function App() {
//     const initialToday: DayEntity = {
//     id: 5,
//     rating: 5,
//     plan: "plan",
//     summary: "summary",
//     localDate: "wow"
// };
    const ROOT_URL = "http://localhost:8080";
    const TASK_URL = ROOT_URL.concat("/api/v1/task");
    const DAY_URL = ROOT_URL.concat("/api/v1/day");
    const date = getCurrentDateFormatted();

    function getCurrentDateFormatted() {
        const date = new Date();
        const year = date.getFullYear();
        const month = `0${date.getMonth() + 1}`.slice(-2);
        const day = `0${date.getDate()}`.slice(-2);
        return `${year}-${month}-${day}`;
    }

    async function fetchTodayUncompletedTasks(): Promise<Task[]> {
      const response = await fetch(TASK_URL.concat(`/get-non-completed-tasks/${date}`));
        return await response.json();
    }
     async function fetchToday(): Promise<DayEntity> {
        const response = await fetch(DAY_URL.concat('/get-today'));
        return await response.json();
    }
    function addTask(taskName: string) {

        fetch(TASK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: taskName,
                completed: false,
                date: date,
            }),
        });
    }
    async function createTask(task: TaskToCreate) {
        return await fetch(TASK_URL.concat("/create-task"), {
            method: "POST",
            body: JSON.stringify({
                taskName: task.name,
                taskDescription: task.description,
                taskPerformTime: task.scheduledPerformDateTime,
                taskTag: task.tag,
                taskImportance: task.importance,
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        })
}
    async function toggleTaskCompletion(taskId: number) {
        await fetch(TASK_URL.concat(`/toggle-task-completion/${taskId}`), {
            method: "POST",
        });
    }

    const [todayTasks, setTodayTasks] = useState<Task[]>([]);
    const [today, setToday] = useState<DayEntity>({} as DayEntity);

    useEffect(() => {
      fetchTodayUncompletedTasks().then((tasks) => setTodayTasks(tasks));
    }, []);

    useEffect(() => {
      fetchToday().then((today) => setToday(today));
    }, []);


    return (
        <>
            <SideNav/>
            <DayModal/>
            <CreateTaskModal/>
            <Header onSubmit={createTask}/>
            <div id="main-container">
                <div className="section left-section">
                    <TaskBox tasks={todayTasks} type={"Today"} toggleTaskCompletion={toggleTaskCompletion}/>
                    <TaskBox tasks={todayTasks} type={"Next week"} toggleTaskCompletion={toggleTaskCompletion}/>
                </div>

                <div className="section center-section">
                    <HighestPriorityTaskBox/>
                    <HighlightedTaskBox/>
                    <Timer/>
                </div>

                <div className="section right-section">
                    <TodayBox today={today}/>
                </div>
            </div>
        </>
    )
}

export default App
