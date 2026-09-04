import React, { createContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import keycloak from '../services/keycloak';
import { statService } from '../services/api/statService';
import { dayService } from '../services/api/dayService';
import { eventService } from '../services/api/eventService';
import { mentalThreadService } from '../services/api/mentalThreadService';
import { taskGroupService } from '../services/api/taskGroupService';
import { userService } from '../services/api/userService';
import { clearMentalThreadHistoryCache } from '../services/cache/mentalThreadHistoryCache';
import { clearPomodoroConfigCache } from '../services/api/pomodoroConfigService';
import { clearAppBootstrap } from '../services/bootstrap/appBootstrap';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    login: (...args: any[]) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);

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
        setLoading(false);
    }, []);

    // Delegates to Keycloak; accepts legacy call signature (email, password) from LoginPage
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const login = useCallback((..._args: unknown[]) => keycloak.login(), []);

    const logout = useCallback(() => {
        clearAppBootstrap();
        statService.clearCache();
        dayService.clearCache();
        eventService.clearCache();
        mentalThreadService.clearCache();
        taskGroupService.clearCache();
        userService.clearPreferencesCache();
        clearMentalThreadHistoryCache();
        clearPomodoroConfigCache();
        return keycloak.logout({ redirectUri: window.location.origin + '/' });
    }, []);

    const contextValue = useMemo(() => ({
        user,
        loading,
        login,
        logout,
        isAuthenticated: keycloak.authenticated ?? false,
    }), [user, loading, login, logout]);

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
}
