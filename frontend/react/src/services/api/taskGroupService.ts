import { TaskGroup } from '../../types/TaskGroup';
import { Task } from '../../types/Task';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const GROUP_URL = `${API_BASE_URL}/api/v1/task-groups`;
const GROUPS_TTL_MS = 30 * 1000;
const groupsCache = new CachedResource<TaskGroup[]>({ ttlMs: GROUPS_TTL_MS, maxEntries: 4 });

function groupsCacheKey(): string {
    return `${getAuthCacheScope()}:groups`;
}

export const taskGroupService = {
    getCachedGroups(): TaskGroup[] | undefined {
        return groupsCache.getCached(groupsCacheKey());
    },

    async getGroups(): Promise<TaskGroup[]> {
        return groupsCache.get(groupsCacheKey(), async () => {
            const response = await fetch(GROUP_URL, { headers: getAuthHeaders() });
            if (!response.ok) {
                throw new Error('Failed to fetch task groups');
            }
            return response.json();
        });
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
        groupsCache.invalidate(groupsCacheKey());
        return response.json();
    },

    async renameGroup(groupId: string, name: string): Promise<TaskGroup> {
        const response = await fetch(`${GROUP_URL}/${groupId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to rename task group');
        }
        groupsCache.invalidate(groupsCacheKey());
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
        groupsCache.invalidate(groupsCacheKey());
        return response.json();
    },

    async moveToToday(groupId: string): Promise<Task[]> {
        const response = await fetch(`${GROUP_URL}/${groupId}/move-to-today`, {
            method: 'PUT',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to move task group to today');
        }
        groupsCache.invalidate(groupsCacheKey());
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
        groupsCache.invalidate(groupsCacheKey());
    },

    async deleteGroup(groupId: string): Promise<void> {
        const response = await fetch(`${GROUP_URL}/${groupId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete task group');
        }
        groupsCache.invalidate(groupsCacheKey());
    },

    clearCache(): void {
        groupsCache.clear();
    },
};
