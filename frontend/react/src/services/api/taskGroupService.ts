import { TaskGroup } from '../../types/TaskGroup';
import { Task } from '../../types/Task';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const GROUP_URL = `${API_BASE_URL}/api/v1/task-groups`;
const GROUPS_TTL_MS = 60 * 60 * 1000;
const GROUP_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const groupsCache = new CachedResource<TaskGroup[]>({ ttlMs: GROUPS_TTL_MS, maxEntries: 4 });

function groupsCacheKey(): string {
    return `${getAuthCacheScope()}:groups`;
}

function groupsStorageKey(): string {
    return `claritard:${groupsCacheKey()}`;
}

function readPersistedGroups(): TaskGroup[] | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.sessionStorage.getItem(groupsStorageKey());
        if (!raw) return undefined;
        const snapshot = JSON.parse(raw) as { savedAt?: number; groups?: TaskGroup[] };
        if (!Array.isArray(snapshot.groups)
            || typeof snapshot.savedAt !== 'number'
            || Date.now() - snapshot.savedAt > GROUP_SNAPSHOT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(groupsStorageKey());
            return undefined;
        }
        return snapshot.groups;
    } catch (error) {
        console.warn('Could not read the cached task groups:', error);
        return undefined;
    }
}

function persistGroups(groups: TaskGroup[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(groupsStorageKey(), JSON.stringify({ savedAt: Date.now(), groups }));
    } catch (error) {
        console.warn('Could not persist the cached task groups:', error);
    }
}

function setGroupsSnapshot(groups: TaskGroup[]): void {
    groupsCache.set(groupsCacheKey(), groups, GROUPS_TTL_MS);
    persistGroups(groups);
}

function updateGroupsSnapshot(update: (groups: TaskGroup[]) => TaskGroup[]): void {
    const groups = groupsCache.getStale(groupsCacheKey()) ?? readPersistedGroups();
    if (groups) setGroupsSnapshot(update(groups));
}

export const taskGroupService = {
    getCachedGroups(): TaskGroup[] | undefined {
        return groupsCache.getStale(groupsCacheKey()) ?? readPersistedGroups();
    },

    async getGroups(): Promise<TaskGroup[]> {
        return groupsCache.get(groupsCacheKey(), async () => {
            const response = await fetch(GROUP_URL, { headers: getAuthHeaders() });
            if (!response.ok) {
                throw new Error('Failed to fetch task groups');
            }
            const groups = await response.json() as TaskGroup[];
            persistGroups(groups);
            return groups;
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
        const createdGroup = await response.json() as TaskGroup;
        updateGroupsSnapshot(groups => [...groups, createdGroup]
            .sort((first, second) => first.displayOrder - second.displayOrder));
        return createdGroup;
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
        const updatedGroup = await response.json() as TaskGroup;
        updateGroupsSnapshot(groups => groups.map(group => (
            group.groupId === updatedGroup.groupId ? updatedGroup : group
        )));
        return updatedGroup;
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
        const updatedGroup = await response.json() as TaskGroup;
        updateGroupsSnapshot(groups => groups.map(group => (
            group.groupId === updatedGroup.groupId ? updatedGroup : group
        )));
        return updatedGroup;
    },

    async moveToToday(groupId: string): Promise<Task[]> {
        const response = await fetch(`${GROUP_URL}/${groupId}/move-to-today`, {
            method: 'PUT',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to move task group to today');
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
        updateGroupsSnapshot(groups => groups.map(group => (
            group.groupId === groupId
                ? { ...group, taskIds: group.taskIds.filter(id => id !== taskId) }
                : group
        )));
    },

    async deleteGroup(groupId: string): Promise<void> {
        const response = await fetch(`${GROUP_URL}/${groupId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete task group');
        }
        updateGroupsSnapshot(groups => groups.filter(group => group.groupId !== groupId));
    },

    clearCache(): void {
        groupsCache.clear();
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.removeItem(groupsStorageKey());
            } catch (error) {
                console.warn('Could not clear the cached task groups:', error);
            }
        }
    },
};
