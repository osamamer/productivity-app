import axios from 'axios';
import apiClient from '../utils/axiosConfig';
import { getAuthCacheScope } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';
import {
    applyUserPreferences,
    clearLegacyUserPreferences,
    readLegacyUserPreferenceUpdates,
} from '../userPreferenceStore';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1`;

export interface UserPreferences {
    includeUnloggedNumericDaysAsZero: boolean;
    autoStartPomodoroSessions: boolean;
    pomodoroSoundId: string | null;
    checkupNotificationsEnabled: boolean;
    repeatCheckupNotificationsEnabled: boolean;
    checkupIntervalMinutes: number;
    checkupStartTime: string;
    checkupTimesPerDay: number;
    showCompletedHomeTasks?: boolean | null;
    excludeTodayCompletedTasks?: boolean | null;
    showClosedMentalThreads?: boolean | null;
    soundEffectsEnabled?: boolean | null;
    whiteNoiseEnabled?: boolean | null;
    pomodoroSecondsMode?: boolean | null;
    pomodoroLongBreakCooldown?: number | null;
    pomodoroFocusDuration?: number | null;
    pomodoroShortBreakDuration?: number | null;
    pomodoroLongBreakDuration?: number | null;
    pomodoroNumFocuses?: number | null;
    themeMode?: 'light' | 'dark' | null;
    accentColor?: string | null;
    meditationDurationMinutes?: number | null;
    meditationIntervalBells?: number | null;
    meditationSound?: 'rain' | 'ocean' | 'forest' | 'bowls' | null;
}

const USER_PREFERENCES_TTL_MS = 5 * 60 * 1000;
const preferencesCache = new CachedResource<UserPreferences>({ ttlMs: USER_PREFERENCES_TTL_MS, maxEntries: 4 });
const preferenceUpdateQueues = new Map<string, Promise<unknown>>();
let preferenceCacheGeneration = 0;
let preferenceMutationVersion = 0;

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
        const cacheKey = preferencesCacheKey();
        const pendingUpdate = preferenceUpdateQueues.get(cacheKey);
        if (pendingUpdate) await pendingUpdate.catch(() => undefined);

        return preferencesCache.get(cacheKey, async () => {
            const requestMutationVersion = preferenceMutationVersion;
            const response = await apiClient.get<UserPreferences>('/api/v1/users/me/preferences');
            const scope = getAuthCacheScope();
            if (requestMutationVersion !== preferenceMutationVersion) {
                return preferencesCache.getCached(cacheKey) ?? response.data;
            }
            applyUserPreferences(scope, response.data);

            const legacyUpdates = readLegacyUserPreferenceUpdates();
            const updatesToMigrate = Object.fromEntries(
                Object.entries(legacyUpdates).filter(([key]) => response.data[key as keyof UserPreferences] == null),
            ) as Partial<UserPreferences>;
            if (Object.keys(updatesToMigrate).length === 0) return response.data;

            try {
                const migrated = await this.updatePreferences(updatesToMigrate);
                clearLegacyUserPreferences();
                return migrated;
            } catch (error) {
                console.warn('Could not migrate device preferences to the user account:', error);
                applyUserPreferences(scope, { ...response.data, ...updatesToMigrate });
                return response.data;
            }
        });
    },

    async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
        const cacheKey = preferencesCacheKey();
        const scope = getAuthCacheScope();
        preferenceMutationVersion += 1;
        const previousUpdate = preferenceUpdateQueues.get(cacheKey) ?? Promise.resolve();
        const generation = preferenceCacheGeneration;
        const request = previousUpdate
            .catch(() => undefined)
            .then(async () => {
                const response = await apiClient.patch<UserPreferences>('/api/v1/users/me/preferences', preferences);
                if (generation === preferenceCacheGeneration) {
                    preferencesCache.set(cacheKey, response.data);
                }
                if (getAuthCacheScope() === scope) {
                    applyUserPreferences(scope, response.data);
                }
                return response.data;
            });

        preferenceUpdateQueues.set(cacheKey, request);
        try {
            return await request;
        } finally {
            if (preferenceUpdateQueues.get(cacheKey) === request) {
                preferenceUpdateQueues.delete(cacheKey);
            }
        }
    },

    clearPreferencesCache(): void {
        preferenceCacheGeneration += 1;
        preferencesCache.clear();
        preferenceUpdateQueues.clear();
    },
};
