import { Task } from '../../types/Task';
import { TaskToCreate } from '../../types/TaskToCreate';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const TASK_URL = `${API_BASE_URL}/api/v1/tasks`;
const SESSION_URL = `${API_BASE_URL}/api/v1/session`;
const POMODORO_URL = `${API_BASE_URL}/api/v1/pomodoro`;

export const taskService = {

    // ============ Task Queries ============

    async getAllMainTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/main`);
        if (!response.ok) {
            throw new Error('Failed to fetch all tasks');
        }
        return response.json();
    },

    async getTodayTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/today`);
        if (!response.ok) {
            throw new Error('Failed to fetch today tasks');
        }
        return response.json();
    },

    async getPastTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}?period=PAST`);
        if (!response.ok) {
            throw new Error('Failed to fetch past tasks');
        }
        return response.json();
    },

    async getFutureTasks(): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}?period=FUTURE`);
        if (!response.ok) {
            throw new Error('Failed to fetch future tasks');
        }
        return response.json();
    },

    async getHighestPriorityTask(): Promise<Task> {
        const response = await fetch(`${TASK_URL}/highest-priority`);
        if (!response.ok) {
            throw new Error('Failed to fetch highest priority task');
        }
        return response.json();
    },

    async getSubtasks(taskId: string): Promise<Task[]> {
        const response = await fetch(`${TASK_URL}/${taskId}/subtasks`);
        if (!response.ok) {
            throw new Error('Failed to fetch subtasks');
        }
        return response.json();
    },

    // ============ Task Mutations ============

    async createTask(task: TaskToCreate): Promise<Task> {
        const response = await fetch(`${TASK_URL}`, {
            method: 'POST',
            body: JSON.stringify({
                name: task.name,
                description: task.description,
                scheduledPerformDateTime: task.scheduledPerformDateTime,
                tag: task.tag,
                importance: task.importance,
                parentId: task.parentId,
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

    async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
        const response = await fetch(`${TASK_URL}/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to update task');
        }
        return response.json();
    },

    async getTask(taskId: string): Promise<Task> {
        const response = await fetch(`${TASK_URL}/${taskId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch task');
        }
        return response.json();
    },

    async toggleTaskCompletion(taskId: string): Promise<Task> {
        // Get current state, then toggle
        const task = await this.getTask(taskId);
        return this.updateTask(taskId, { completed: !task.completed });
    },



    async updateDescription(taskId: string, description: string): Promise<Task> {
        return this.updateTask(taskId, { description });
    },

    async deleteTask(taskId: string): Promise<void> {
        const response = await fetch(`${TASK_URL}/${taskId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error('Failed to delete task');
        }
    },

    // ============ Session Operations ============

    async startSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/start/${taskId}`, {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Failed to start session');
        }
    },

    async pauseSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/pause/${taskId}`, {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Failed to pause session');
        }
    },

    async unpauseSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/unpause/${taskId}`, {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Failed to unpause session');
        }
    },

    async endSession(taskId: string): Promise<void> {
        const response = await fetch(`${SESSION_URL}/end/${taskId}`, {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Failed to end session');
        }
    },

    // ============ Pomodoro Operations ============

    async startPomodoro(
        taskId: string,
        focusDuration: number,
        shortBreakDuration: number,
        longBreakDuration: number,
        numFocuses: number,
        longBreakCooldown: number
    ): Promise<void> {
        const response = await fetch(`${POMODORO_URL}/start`, {
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
        console.log("Started Pomodoro.");
    },

    async endPomodoro(taskId: string): Promise<void> {
        const response = await fetch(`${POMODORO_URL}/end/${taskId}`, {
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Failed to end pomodoro');
        }
        console.log("Ended Pomodoro.");
    },
};