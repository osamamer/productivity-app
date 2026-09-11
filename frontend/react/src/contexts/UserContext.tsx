import React, { createContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import keycloak, { endCurrentSession } from '../services/keycloak';
import { statService } from '../services/api/statService';
import { dayService } from '../services/api/dayService';
import { eventService } from '../services/api/eventService';
import { mentalThreadService } from '../services/api/mentalThreadService';
import { taskGroupService } from '../services/api/taskGroupService';
import { taskService } from '../services/api/taskService';
import { userService } from '../services/api/userService';
import { clearMentalThreadHistoryCache } from '../services/cache/mentalThreadHistoryCache';
import { clearPomodoroConfigCache } from '../services/api/pomodoroConfigService';
import { clearPomodoroSoundCache } from '../services/api/pomodoroSoundService';
import { resetWhiteNoiseSource } from '../services/whiteNoise';
import { clearAppBootstrap } from '../services/bootstrap/appBootstrap';
import { sideNavSnapshotCache } from '../services/cache/sideNavSnapshotCache';

interface UserInfo {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    active: boolean;
    createdAt: string;
}

interface UserContextType {
    user: UserInfo | null;
    loading: boolean;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserInfo | null>(null);
    // main.tsx renders the React tree only after Keycloak initialization succeeds.
    // There is no second user-loading phase for the protected app to display.
    const loading = false;

    useEffect(() => {
        const parsed = keycloak.tokenParsed;
        if (parsed) {
            setUser({
                id: parsed.sub ?? '',
                email: parsed['email'] ?? '',
                firstName: parsed['given_name'] ?? '',
                lastName: parsed['family_name'] ?? '',
                username: parsed['preferred_username'] ?? '',
                active: true,
                createdAt: '',
            });
        }
    }, []);

    const logout = useCallback(async () => {
        clearAppBootstrap();
        statService.clearCache();
        dayService.clearCache();
        eventService.clearCache();
        mentalThreadService.clearCache();
        taskGroupService.clearCache();
        taskService.clearCache();
        userService.clearPreferencesCache();
        clearMentalThreadHistoryCache();
        clearPomodoroConfigCache();
        clearPomodoroSoundCache();
        resetWhiteNoiseSource();
        sideNavSnapshotCache.clear();
        await endCurrentSession();
        window.location.replace('/sign-in');
    }, []);

    const contextValue = useMemo(() => ({
        user,
        loading,
        logout,
        isAuthenticated: keycloak.authenticated ?? false,
    }), [user, loading, logout]);

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
}
