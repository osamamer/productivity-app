import { Task } from '../../types/Task';
import { TaskToCreate } from '../../types/TaskToCreate';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const TASK_URL = `${API_BASE_URL}/api/v1/task`;

export const taskService = {

    async getAllTasks(): Promise<Task[]> {
        const response = await fetch(TASK_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch all tasks');
        }
        return response.json();
    },

    async getTodayTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/get-today-tasks`);
        if (!response.ok) {
            throw new Error('Failed to fetch today tasks');
        }
        return response.json();
    },

    async getPastTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/get-past-tasks`);
        if (!response.ok) {
            throw new Error('Failed to fetch past tasks');
        }
        return response.json();
    },

    async getFutureTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/get-future-tasks`);
        if (!response.ok) {
            throw new Error('Failed to fetch future tasks');
        }
        return response.json();
    },

    async getHighestPriorityTask(): Promise<Task> {
        const response = await fetch(
            `${TASK_URL}/get-newest-uncompleted-highest-priority-task`
        );
        if (!response.ok) {
            throw new Error('Failed to fetch highest priority task');
        }
        return response.json();
    },

    async createTask(task: TaskToCreate): Promise<Task> {
        const response = await fetch(`${TASK_URL}/create-task`, {
            method: 'POST',
            body: JSON.stringify({
                taskName: task.name,
                taskDescription: task.description,
                taskPerformTime: task.scheduledPerformDateTime,
                taskTag: task.tag,
                taskImportance: task.importance,
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to create task');
        }
            return response.json();
    },


    async toggleTaskCompletion(taskId: string): Promise<void> {
        const response = await fetch(
            `${TASK_URL}/toggle-task-completion/${taskId}`,
            {
                method: 'POST',
            }
        );
        if (!response.ok) {
            throw new Error('Failed to toggle task completion');
        }
    },


    async completeTask(taskId: string): Promise<void> {
        const response = await fetch(`${TASK_URL}/complete-task/${taskId}`, {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Failed to complete task');
        }
    },


    async updateDescription(taskId: string, description: string): Promise<void> {
        const response = await fetch(`${TASK_URL}/set-description`, {
            method: 'POST',
            body: JSON.stringify({
                taskId,
                taskDescription: description,
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to update description');
        }
        else {
            console.log("Updated description.");
        }
    },


    async startPomodoro(
        taskId: string,
        focusDuration: number,
        shortBreakDuration: number,
        longBreakDuration: number,
        numFocuses: number,
        longBreakCooldown: number
    ): Promise<void> {
        const response = await fetch(`${TASK_URL}/start-pomodoro`, {
            method: 'POST',
            body: JSON.stringify({
                taskId,
                focusDuration,
                shortBreakDuration,
                longBreakDuration,
                numFocuses,
                longBreakCooldown,
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to start pomodoro');
        }
        else {
            console.log("Started Pomodoro.");
        }
    },
};