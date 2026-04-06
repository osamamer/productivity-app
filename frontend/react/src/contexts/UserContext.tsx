import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import keycloak from '../services/keycloak';

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

const UserContext = createContext<UserContextType | undefined>(undefined);

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
    const login = (..._args: unknown[]) => keycloak.login();

    const logout = () => keycloak.logout({ redirectUri: window.location.origin + '/' });

    return (
        <UserContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated: keycloak.authenticated ?? false,
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
