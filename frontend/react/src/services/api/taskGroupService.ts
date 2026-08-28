import { TaskGroup } from '../../types/TaskGroup';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const GROUP_URL = `${API_BASE_URL}/api/v1/task-groups`;

export const taskGroupService = {
    async getGroups(): Promise<TaskGroup[]> {
        const response = await fetch(GROUP_URL, { headers: getAuthHeaders() });
        if (!response.ok) {
            throw new Error('Failed to fetch task groups');
        }
        return response.json();
    },

    async createGroup(name: string, taskIds: string[]): Promise<TaskGroup> {
        const response = await fetch(GROUP_URL, {
            method: 'POST',
            body: JSON.stringify({ name, taskIds }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to create task group');
        }
        return response.json();
    },

    async replaceTasks(groupId: string, taskIds: string[]): Promise<TaskGroup> {
        const response = await fetch(`${GROUP_URL}/${groupId}/tasks`, {
            method: 'PUT',
            body: JSON.stringify({ taskIds }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to update task group membership');
        }
        return response.json();
    },

    async removeTask(groupId: string, taskId: string): Promise<void> {
        const response = await fetch(`${GROUP_URL}/${groupId}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to remove task from group');
        }
    },

    async deleteGroup(groupId: string): Promise<void> {
        const response = await fetch(`${GROUP_URL}/${groupId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete task group');
        }
    },
};
