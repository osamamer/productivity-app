import { Client, StompSubscription } from '@stomp/stompjs';
import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { taskService } from '../services/api/taskService';
import { CachedResource } from '../services/cache/ttlCache';
import { playAudioFeedback } from '../services/audioFeedback';
import { createAuthenticatedStompClient } from '../services/authenticatedStompClient';
import { getAuthCacheScope } from '../services/utils/authHeaders';
import { subscribeToUserPreferences } from '../services/userPreferenceStore';
import {
    isWhiteNoiseEnabled,
    pauseWhiteNoise,
    setWhiteNoiseEnabled as persistWhiteNoiseEnabled,
    startWhiteNoise,
    stopWhiteNoise,
} from '../services/whiteNoise';
import { PomodoroStatus } from '../types/PomodoroStatus';

const WS_URL = import.meta.env.VITE_WS_URL
    || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const ACTIVE_POMODORO_CACHE_TTL_MS = 30_000;
const ACTIVE_POMODORO_REFRESH_MS = 15_000;
const ACTIVE_POMODORO_STORAGE_PREFIX = 'claritard:active-pomodoro:';

const activePomodoroCache = new CachedResource<PomodoroStatus | null>({
    ttlMs: ACTIVE_POMODORO_CACHE_TTL_MS,
    maxEntries: 4,
});

function activePomodoroCacheKey(): string {
    return `${getAuthCacheScope()}:active-pomodoro`;
}

function readPersistedActivePomodoro(cacheKey: string): PomodoroStatus | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(`${ACTIVE_POMODORO_STORAGE_PREFIX}${cacheKey}`);
        if (!raw) return null;

        const status = JSON.parse(raw) as Partial<PomodoroStatus>;
        if (status.active !== true
            || typeof status.pomodoroId !== 'string'
            || typeof status.associatedTaskId !== 'string') {
            return null;
        }
        return status as PomodoroStatus;
    } catch (error) {
        console.warn('Could not restore the active Pomodoro:', error);
        return null;
    }
}

function persistActivePomodoro(cacheKey: string, status: PomodoroStatus | null): void {
    if (typeof window === 'undefined') return;

    try {
        const storageKey = `${ACTIVE_POMODORO_STORAGE_PREFIX}${cacheKey}`;
        if (status) window.sessionStorage.setItem(storageKey, JSON.stringify(status));
        else window.sessionStorage.removeItem(storageKey);
    } catch (error) {
        console.warn('Could not preserve the active Pomodoro:', error);
    }
}

export interface PomodoroContextValue {
    activePomodoro: PomodoroStatus | null;
    pomodoroStatusResolved: boolean;
    refreshActivePomodoro: (force?: boolean) => Promise<PomodoroStatus | null>;
    publishPomodoroStatus: (
        status: PomodoroStatus | null,
        authoritative?: boolean,
        optimistic?: boolean,
    ) => boolean;
    clearPomodoroMutation: () => void;
    whiteNoiseEnabled: boolean;
    setWhiteNoiseEnabled: (enabled: boolean) => void;
    toggleWhiteNoise: () => void;
}

export const PomodoroContext = createContext<PomodoroContextValue | undefined>(undefined);

export function PomodoroProvider({ children }: { children: ReactNode }) {
    const cacheKey = activePomodoroCacheKey();
    const [activePomodoro, setActivePomodoro] = useState<PomodoroStatus | null>(
        () => {
            const cached = activePomodoroCache.getStale(cacheKey);
            return cached === undefined ? readPersistedActivePomodoro(cacheKey) : cached;
        },
    );
    const [pomodoroStatusResolved, setPomodoroStatusResolved] = useState(false);
    const [whiteNoiseEnabled, setWhiteNoiseEnabledState] = useState(isWhiteNoiseEnabled);
    const [stompConnected, setStompConnected] = useState(false);
    const activePomodoroRef = useRef(activePomodoro);
    const statusRevisionRef = useRef(0);
    const retiredPomodoroIdsRef = useRef(new Set<string>());
    const optimisticPomodoroStatusRef = useRef<PomodoroStatus | null>(null);
    const refreshRequestRef = useRef<Promise<PomodoroStatus | null> | null>(null);
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);

    useEffect(() => subscribeToUserPreferences(() => {
        setWhiteNoiseEnabledState(isWhiteNoiseEnabled());
    }), []);

    const optimisticStatusAllowsUpdate = useCallback((nextStatus: PomodoroStatus | null): boolean => {
        const optimisticStatus = optimisticPomodoroStatusRef.current;
        if (!optimisticStatus) return true;

        if (!nextStatus) return !optimisticStatus.active;
        if (nextStatus.pomodoroId !== optimisticStatus.pomodoroId) return true;
        if (!optimisticStatus.active) return !nextStatus.active;
        if (!nextStatus.active) return true;

        return optimisticStatus.sessionActive === nextStatus.sessionActive
            && optimisticStatus.sessionRunning === nextStatus.sessionRunning
            && optimisticStatus.phase === nextStatus.phase;
    }, []);

    const commitPomodoroStatus = useCallback((
        nextStatus: PomodoroStatus | null,
        authoritative = false,
        optimistic = false,
    ): boolean => {
        if (!optimistic && !optimisticStatusAllowsUpdate(nextStatus)) {
            // A live snapshot can race the request that changed this state.
            // Keep the optimistic state until a matching authoritative read
            // arrives instead of making the control visibly jump backwards.
            return false;
        }

        const currentStatus = activePomodoroRef.current;
        const retiredPomodoroIds = retiredPomodoroIdsRef.current;

        if (!nextStatus) {
            if (currentStatus) retiredPomodoroIds.add(currentStatus.pomodoroId);
        } else if (!nextStatus.active) {
            retiredPomodoroIds.add(nextStatus.pomodoroId);
            if (currentStatus && nextStatus.pomodoroId !== currentStatus.pomodoroId) {
                // A delayed completion event from an older session must not
                // clear a newer active session from the shared app state.
                return false;
            }
            if (nextStatus.phase === 'COMPLETED' && currentStatus?.active) {
                playAudioFeedback('pomodoroCompleted');
            }
        } else if (!authoritative && retiredPomodoroIds.has(nextStatus.pomodoroId)) {
            // A delayed active event can arrive after the session was ended.
            return false;
        } else if (currentStatus && nextStatus.pomodoroId !== currentStatus.pomodoroId) {
            // Seeing a different active ID means the previous one is no
            // longer current; reject any later events for that old session.
            retiredPomodoroIds.add(currentStatus.pomodoroId);
        }

        // The authenticated status endpoint is the source of truth. A prior
        // empty response or completion event must not permanently suppress a
        // Pomodoro that the server still reports as active.
        if (authoritative && nextStatus?.active) {
            retiredPomodoroIds.delete(nextStatus.pomodoroId);
        }

        while (retiredPomodoroIds.size > 32) {
            const oldestId = retiredPomodoroIds.values().next().value as string | undefined;
            if (oldestId === undefined) break;
            retiredPomodoroIds.delete(oldestId);
        }

        const nextActiveStatus = nextStatus?.active ? nextStatus : null;
        if (optimistic) optimisticPomodoroStatusRef.current = nextStatus;
        else if (authoritative) optimisticPomodoroStatusRef.current = null;
        activePomodoroRef.current = nextActiveStatus;
        statusRevisionRef.current += 1;
        activePomodoroCache.set(cacheKey, nextActiveStatus, ACTIVE_POMODORO_CACHE_TTL_MS);
        persistActivePomodoro(cacheKey, nextActiveStatus);
        setActivePomodoro(nextActiveStatus);
        return true;
    }, [cacheKey, optimisticStatusAllowsUpdate]);

    const publishPomodoroStatus = useCallback(
        (
            nextStatus: PomodoroStatus | null,
            authoritative = false,
            optimistic = false,
        ) => (
            commitPomodoroStatus(nextStatus, authoritative, optimistic)
        ),
        [commitPomodoroStatus],
    );

    const clearPomodoroMutation = useCallback(() => {
        optimisticPomodoroStatusRef.current = null;
    }, []);

    const refreshActivePomodoro = useCallback(async (force = false) => {
        if (refreshRequestRef.current) return refreshRequestRef.current;

        const revisionAtStart = statusRevisionRef.current;
        const request = force
            ? taskService.getActivePomodoro()
            : activePomodoroCache.get(cacheKey, () => taskService.getActivePomodoro());
        refreshRequestRef.current = request;

        try {
            const nextStatus = await request;
            if (revisionAtStart === statusRevisionRef.current) {
                commitPomodoroStatus(nextStatus, true);
            }
            return activePomodoroRef.current;
        } finally {
            if (refreshRequestRef.current === request) refreshRequestRef.current = null;
        }
    }, [cacheKey, commitPomodoroStatus]);

    useEffect(() => {
        let cancelled = false;

        const refresh = (force: boolean) => {
            void refreshActivePomodoro(force)
                .catch(error => console.error('Could not refresh the active Pomodoro:', error))
                .finally(() => {
                    if (!cancelled) setPomodoroStatusResolved(true);
                });
        };

        refresh(false);
        const intervalId = window.setInterval(() => refresh(true), ACTIVE_POMODORO_REFRESH_MS);
        const handleFocus = () => refresh(true);
        const handleVisibilityChange = () => {
            if (!document.hidden) refresh(true);
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshActivePomodoro]);

    useEffect(() => {
        const client = createAuthenticatedStompClient(WS_URL);
        client.onConnect = () => {
            if (stompClientRef.current === client) setStompConnected(true);
        };
        client.onStompError = frame => {
            console.error('Pomodoro status channel reported an error:', frame);
            if (stompClientRef.current === client) setStompConnected(false);
        };
        client.onDisconnect = () => {
            if (stompClientRef.current === client) setStompConnected(false);
        };
        client.onWebSocketError = error => {
            console.error('Pomodoro status channel failed:', error);
            if (stompClientRef.current === client) setStompConnected(false);
        };

        stompClientRef.current = client;
        try {
            client.activate();
        } catch (error) {
            console.error('Could not activate the Pomodoro status channel:', error);
        }

        return () => {
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
            void client.deactivate();
            stompClientRef.current = null;
        };
    }, []);

    const activeTaskId = activePomodoro?.associatedTaskId ?? null;
    useEffect(() => {
        const client = stompClientRef.current;
        const previousSubscription = subscriptionRef.current;
        previousSubscription?.unsubscribe();
        subscriptionRef.current = null;

        if (!stompConnected || !client?.active || !activeTaskId) return;

        try {
            const subscription = client.subscribe(
                `/topic/pomodoro/${activeTaskId}`,
                message => {
                    try {
                        publishPomodoroStatus(JSON.parse(message.body) as PomodoroStatus);
                    } catch (error) {
                        console.error('Could not parse a Pomodoro status update:', error);
                    }
                },
            );
            subscriptionRef.current = subscription;
            return () => {
                subscription.unsubscribe();
                if (subscriptionRef.current === subscription) subscriptionRef.current = null;
            };
        } catch (error) {
            console.error('Could not subscribe to the active Pomodoro:', error);
        }
    }, [activeTaskId, publishPomodoroStatus, stompConnected]);

    const isFocusRunning = Boolean(
        activePomodoro?.active
        && activePomodoro.sessionActive
        && activePomodoro.sessionRunning
        && activePomodoro.phase !== 'BREAK'
        && activePomodoro.phase !== 'WAITING_FOR_BREAK',
    );
    useEffect(() => {
        if (!activePomodoro?.active) {
            stopWhiteNoise();
        } else if (isFocusRunning && whiteNoiseEnabled) {
            void startWhiteNoise();
        } else {
            pauseWhiteNoise();
        }
    }, [
        activePomodoro?.active,
        activePomodoro?.phase,
        activePomodoro?.pomodoroId,
        activePomodoro?.sessionActive,
        activePomodoro?.sessionRunning,
        isFocusRunning,
        whiteNoiseEnabled,
    ]);

    const updateWhiteNoiseEnabled = useCallback((enabled: boolean) => {
        setWhiteNoiseEnabledState(enabled);
        persistWhiteNoiseEnabled(enabled);
    }, []);
    const toggleWhiteNoise = useCallback(() => {
        updateWhiteNoiseEnabled(!whiteNoiseEnabled);
    }, [updateWhiteNoiseEnabled, whiteNoiseEnabled]);

    const contextValue = useMemo(() => ({
        activePomodoro,
        pomodoroStatusResolved,
        refreshActivePomodoro,
        publishPomodoroStatus,
        clearPomodoroMutation,
        whiteNoiseEnabled,
        setWhiteNoiseEnabled: updateWhiteNoiseEnabled,
        toggleWhiteNoise,
    }), [
        activePomodoro,
        clearPomodoroMutation,
        pomodoroStatusResolved,
        publishPomodoroStatus,
        refreshActivePomodoro,
        toggleWhiteNoise,
        updateWhiteNoiseEnabled,
        whiteNoiseEnabled,
    ]);

    return (
        <PomodoroContext.Provider value={contextValue}>
            {children}
        </PomodoroContext.Provider>
    );
}
