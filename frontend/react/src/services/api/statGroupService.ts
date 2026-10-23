import { apiFetch } from '../utils/apiFetch';
import { StatGroup } from '../../types/StatGroup';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';
import { invalidateResource } from '../cache/resourceInvalidation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const GROUPS_URL = `${API_BASE_URL}/api/v1/stats/groups`;
const GROUPS_TTL_MS = 24 * 60 * 60 * 1000;
const groupsCache = new CachedResource<StatGroup[]>({ ttlMs: GROUPS_TTL_MS, maxEntries: 4 });

function invalidateGroups(): void {
    groupsCache.invalidate(groupsCacheKey());
    invalidateResource('stats', 'stat-group');
}

function groupsCacheKey(): string {
    return `${getAuthCacheScope()}:stat-groups`;
}

export const statGroupService = {
    getCachedGroups(): StatGroup[] | undefined {
        return groupsCache.getStale(groupsCacheKey());
    },

    async getGroups(): Promise<StatGroup[]> {
        return groupsCache.get(groupsCacheKey(), async () => {
            const response = await apiFetch(GROUPS_URL, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch stat groups');
            return response.json();
        });
    },

    async createGroup(name: string, statDefinitionIds: string[] = []): Promise<StatGroup> {
        const response = await apiFetch(GROUPS_URL, {
            method: 'POST',
            body: JSON.stringify({ name, statDefinitionIds }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) throw new Error('Failed to create stat group');
        const group = await response.json() as StatGroup;
        invalidateGroups();
        return group;
    },

    async reorderGroups(groupIds: string[]): Promise<StatGroup[]> {
        const response = await apiFetch(`${GROUPS_URL}/order`, {
            method: 'PUT',
            body: JSON.stringify({ groupIds }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) throw new Error('Failed to reorder stat groups');
        const groups = await response.json() as StatGroup[];
        invalidateGroups();
        return groups;
    },

    async renameGroup(groupId: string, name: string): Promise<StatGroup> {
        const response = await apiFetch(`${GROUPS_URL}/${groupId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) throw new Error('Failed to rename stat group');
        const group = await response.json() as StatGroup;
        invalidateGroups();
        return group;
    },

    async replaceDefinitions(groupId: string, statDefinitionIds: string[]): Promise<StatGroup> {
        const response = await apiFetch(`${GROUPS_URL}/${groupId}/definitions`, {
            method: 'PUT',
            body: JSON.stringify({ statDefinitionIds }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) throw new Error('Failed to update stat group membership');
        const group = await response.json() as StatGroup;
        invalidateGroups();
        return group;
    },

    async deleteGroup(groupId: string): Promise<void> {
        const response = await apiFetch(`${GROUPS_URL}/${groupId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete stat group');
        invalidateGroups();
    },

    clearCache(): void {
        groupsCache.clear();
    },
};
