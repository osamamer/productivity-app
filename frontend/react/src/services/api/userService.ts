import axios from 'axios';
import apiClient from '../utils/axiosConfig';
import { getAuthCacheScope } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1`;

export interface UserPreferences {
    includeUnloggedNumericDaysAsZero: boolean;
    autoStartPomodoroSessions: boolean;
    checkupNotificationsEnabled: boolean;
    checkupIntervalMinutes: number;
    checkupStartTime: string;
    checkupTimesPerDay: number;
}

const USER_PREFERENCES_TTL_MS = 5 * 60 * 1000;
const preferencesCache = new CachedResource<UserPreferences>({ ttlMs: USER_PREFERENCES_TTL_MS, maxEntries: 4 });

function preferencesCacheKey(): string {
    return `${getAuthCacheScope()}:preferences`;
}

export const userService = {
    async createUser(userData: {
        email: string;
        firstName: string;
        lastName: string;
        username: string;
        keycloakId?: string | null;
    }) {
        const response = await axios.post(`${API_BASE_URL}/users`, userData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    },

    async getUserById(userId: string) {
        const response = await axios.get(`${API_BASE_URL}/users/${userId}`);
        return response.data;
    },

    async getUserByEmail(email: string) {
        const response = await axios.get(`${API_BASE_URL}/users/email/${email}`);
        return response.data;
    },

    async getUserByUsername(username: string) {
        const response = await axios.get(`${API_BASE_URL}/users/username/${username}`);
        return response.data;
    },

    async getAllUsers() {
        const response = await axios.get(`${API_BASE_URL}/users`);
        return response.data;
    },

    async updateUser(userId: string, userData: {
        email?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
    }) {
        const response = await axios.put(`${API_BASE_URL}/users/${userId}`, userData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    },

    async deactivateUser(userId: string) {
        const response = await axios.patch(`${API_BASE_URL}/users/${userId}/deactivate`);
        return response.data;
    },

    async activateUser(userId: string) {
        const response = await axios.patch(`${API_BASE_URL}/users/${userId}/activate`);
        return response.data;
    },

    async deleteUser(userId: string) {
        await axios.delete(`${API_BASE_URL}/users/${userId}`);
    },

    async changePassword(passwords: {
        currentPassword: string;
        newPassword: string;
    }) {
        await apiClient.put('/api/v1/users/me/password', passwords);
    },

    async getPreferences(): Promise<UserPreferences> {
        return preferencesCache.get(preferencesCacheKey(), async () => {
            const response = await apiClient.get<UserPreferences>('/api/v1/users/me/preferences');
            return response.data;
        });
    },

    async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
        const response = await apiClient.patch<UserPreferences>('/api/v1/users/me/preferences', preferences);
        preferencesCache.set(preferencesCacheKey(), response.data);
        return response.data;
    },

    clearPreferencesCache(): void {
        preferencesCache.clear();
    },
};
