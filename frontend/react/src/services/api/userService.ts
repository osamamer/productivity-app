import axios from 'axios';
import apiClient from '../utils/axiosConfig';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { apiFetch } from '../utils/apiFetch';
import { isDefinitiveRefreshFailure, redirectToSignIn, refreshAuthToken } from '../keycloak';
import { CachedResource } from '../cache/ttlCache';
import {
    applyUserPreferences,
    clearLegacyUserPreferences,
    readLegacyUserPreferenceUpdates,
} from '../userPreferenceStore';
import { PendingPreferenceUpdates } from './pendingPreferenceUpdates';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1`;

export interface UserPreferences {
    autoStartPomodoroSessions: boolean;
    pomodoroSoundId: string | null;
    checkupNotificationsEnabled: boolean;
    repeatCheckupNotificationsEnabled: boolean;
    checkupIntervalMinutes: number;
    checkupStartTime: string;
    checkupTimesPerDay: number;
    checkupTimeZone?: string;
    showCompletedHomeTasks?: boolean | null;
    excludeTodayCompletedTasks?: boolean | null;
    homeDayEndHour?: number | null;
    showClosedMentalThreads?: boolean | null;
    soundEffectsEnabled?: boolean | null;
    whiteNoiseEnabled?: boolean | null;
    muteFocusNoiseDuringBreaks?: boolean | null;
    pomodoroSecondsMode?: boolean | null;
    pomodoroLongBreakCooldown?: number | null;
    pomodoroFocusDuration?: number | null;
    pomodoroShortBreakDuration?: number | null;
    pomodoroLongBreakDuration?: number | null;
    pomodoroNumFocuses?: number | null;
    pomodoroTimeAdjustmentMinutes?: number | null;
    themeMode?: 'light' | 'dark' | null;
    accentColor?: string | null;
    meditationDurationMinutes?: number | null;
    meditationIntervalBells?: number | null;
    meditationSound?: 'rain' | 'ocean' | 'forest' | 'bowls' | null;
}

const USER_PREFERENCES_TTL_MS = 24 * 60 * 60 * 1000;
const PREFERENCES_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const preferencesCache = new CachedResource<UserPreferences>({ ttlMs: USER_PREFERENCES_TTL_MS, maxEntries: 4 });
const preferenceUpdateQueues = new Map<string, Promise<unknown>>();
const pendingPreferenceUpdates = new PendingPreferenceUpdates<UserPreferences>();
let preferenceCacheGeneration = 0;
let preferenceMutationVersion = 0;

function preferencesCacheKey(): string {
    return `${getAuthCacheScope()}:preferences`;
}

function preferencesSnapshotKey(): string {
    return `claritard:${getAuthCacheScope()}:preferences`;
}

function readPreferencesSnapshot(): UserPreferences | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        const raw = window.sessionStorage.getItem(preferencesSnapshotKey());
        if (!raw) return undefined;
        const snapshot = JSON.parse(raw) as { savedAt?: number; preferences?: UserPreferences };
        if (typeof snapshot.savedAt !== 'number'
            || Date.now() - snapshot.savedAt > PREFERENCES_SNAPSHOT_MAX_AGE_MS
            || !snapshot.preferences || typeof snapshot.preferences !== 'object') {
            window.sessionStorage.removeItem(preferencesSnapshotKey());
            return undefined;
        }
        return snapshot.preferences;
    } catch (error) {
        console.warn('Could not read cached preferences:', error);
        return undefined;
    }
}

function persistPreferencesSnapshot(preferences: UserPreferences): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(preferencesSnapshotKey(), JSON.stringify({
            savedAt: Date.now(), preferences,
        }));
    } catch (error) {
        console.warn('Could not cache preferences:', error);
    }
}

export const userService = {
    hydrateCachedPreferences(): boolean {
        const preferences = readPreferencesSnapshot();
        if (!preferences) return false;
        applyUserPreferences(getAuthCacheScope(), preferences);
        return true;
    },

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
            try {
                await refreshAuthToken(30);
            } catch (error) {
                if (isDefinitiveRefreshFailure(error)) {
                    redirectToSignIn();
                    throw error;
                }
                console.warn('Could not refresh the preference request session; using the current token:', error);
            }
            const response = await apiFetch(`${API_BASE_URL}/users/me/preferences`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to load account preferences');
            const preferences = await response.json() as UserPreferences;
            const scope = getAuthCacheScope();
            if (requestMutationVersion !== preferenceMutationVersion) {
                return preferencesCache.getCached(cacheKey) ?? preferences;
            }
            applyUserPreferences(scope, preferences);
            persistPreferencesSnapshot(preferences);

            const legacyUpdates = readLegacyUserPreferenceUpdates();
            const updatesToMigrate = Object.fromEntries(
                Object.entries(legacyUpdates).filter(([key]) => preferences[key as keyof UserPreferences] == null),
            ) as Partial<UserPreferences>;
            if (Object.keys(updatesToMigrate).length === 0) return preferences;

            try {
                const migrated = await this.updatePreferences(updatesToMigrate);
                clearLegacyUserPreferences();
                return migrated;
            } catch (error) {
                console.warn('Could not migrate device preferences to the user account:', error);
                applyUserPreferences(scope, { ...preferences, ...updatesToMigrate });
                return preferences;
            }
        });
    },

    async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
        const cacheKey = preferencesCacheKey();
        const scope = getAuthCacheScope();
        const mutationVersion = ++preferenceMutationVersion;
        pendingPreferenceUpdates.record(cacheKey, mutationVersion, preferences);

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
                    const latestPreferences = pendingPreferenceUpdates.mergeNewer(
                        cacheKey, response.data, mutationVersion,
                    );
                    persistPreferencesSnapshot(latestPreferences);
                    applyUserPreferences(scope, latestPreferences);
                }
                pendingPreferenceUpdates.removeThrough(cacheKey, mutationVersion);
                return response.data;
            });

        preferenceUpdateQueues.set(cacheKey, request);
        try {
            return await request;
        } catch (error) {
            pendingPreferenceUpdates.removeThrough(cacheKey, mutationVersion);
            const savedPreferences = preferencesCache.getCached(cacheKey)
                ?? preferencesCache.getStale(cacheKey);
            if (savedPreferences && getAuthCacheScope() === scope) {
                applyUserPreferences(
                    scope,
                    pendingPreferenceUpdates.mergeNewer(cacheKey, savedPreferences, 0),
                );
            }
            throw error;
        } finally {
            if (preferenceUpdateQueues.get(cacheKey) === request) {
                preferenceUpdateQueues.delete(cacheKey);
            }
        }
    },

    clearPreferencesCache(): void {
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.removeItem(preferencesSnapshotKey());
            } catch (error) {
                console.warn('Could not clear cached preferences:', error);
            }
        }
        preferenceCacheGeneration += 1;
        preferencesCache.clear();
        preferenceUpdateQueues.clear();
        pendingPreferenceUpdates.clear();
    },
};
