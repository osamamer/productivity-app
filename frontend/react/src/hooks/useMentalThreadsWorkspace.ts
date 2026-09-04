import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AttentionState,
    CloseMentalThreadInput,
    MentalThread,
    MentalThreadInput,
    MentalThreadSummary,
} from '../types/MentalThread.ts';
import { mentalThreadService } from '../services/api/mentalThreadService.ts';
import { invalidateMentalThreadHistory } from '../services/cache/mentalThreadHistoryCache.ts';

const HIGH_LOAD_THRESHOLD = 7;

function compareThreads(first: MentalThread, second: MentalThread): number {
    if (first.status !== second.status) return first.status === 'OPEN' ? -1 : 1;
    if (first.currentMentalLoad !== second.currentMentalLoad) {
        return second.currentMentalLoad - first.currentMentalLoad;
    }

    const firstTargetDate = first.targetCloseDate ?? '9999-12-31';
    const secondTargetDate = second.targetCloseDate ?? '9999-12-31';
    if (firstTargetDate !== secondTargetDate) return firstTargetDate.localeCompare(secondTargetDate);
    return second.updatedAt.localeCompare(first.updatedAt);
}

function attentionCountKey(state: AttentionState):
    'actingCount' | 'ruminatingCount' | 'plannedCount' | 'pendingCount' {
    switch (state) {
        case 'ACTING': return 'actingCount';
        case 'RUMINATING': return 'ruminatingCount';
        case 'PLANNED': return 'plannedCount';
        case 'PENDING': return 'pendingCount';
        default: return 'pendingCount';
    }
}

function updateSummaryForThread(
    summary: MentalThreadSummary,
    previousThread: MentalThread,
    updatedThread: MentalThread,
): MentalThreadSummary {
    if (previousThread.status !== 'OPEN' || updatedThread.status !== 'OPEN') return summary;

    const nextSummary = {
        ...summary,
        totalLoad: summary.totalLoad + updatedThread.currentMentalLoad - previousThread.currentMentalLoad,
        highLoadCount: summary.highLoadCount
            + (updatedThread.currentMentalLoad >= HIGH_LOAD_THRESHOLD ? 1 : 0)
            - (previousThread.currentMentalLoad >= HIGH_LOAD_THRESHOLD ? 1 : 0),
    };

    if (previousThread.attentionState !== updatedThread.attentionState) {
        nextSummary[attentionCountKey(previousThread.attentionState)] -= 1;
        nextSummary[attentionCountKey(updatedThread.attentionState)] += 1;
    }

    return nextSummary;
}

function applyThreadToState(
    currentThreads: MentalThread[],
    threadId: string,
    replacement: MentalThread,
): MentalThread[] {
    return currentThreads
        .map(thread => thread.id === threadId ? replacement : thread)
        .sort(compareThreads);
}

export function useMentalThreadsWorkspace() {
    const [threads, setThreads] = useState<MentalThread[]>([]);
    const [summary, setSummary] = useState<MentalThreadSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);
    const threadsRef = useRef<MentalThread[]>([]);
    const threadMutationVersionsRef = useRef(new Map<string, number>());
    const capacityMutationVersionRef = useRef(0);

    const reload = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const [loadedThreads, loadedSummary] = await Promise.all([
                mentalThreadService.getThreads(true),
                mentalThreadService.getSummary(),
            ]);
            if (signal?.aborted) return;
            threadsRef.current = loadedThreads;
            setThreads(loadedThreads);
            setSummary(loadedSummary);
        } catch (loadError) {
            if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
            setError(loadError instanceof Error ? loadError.message : 'Failed to load mental threads');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void reload(controller.signal);
        return () => controller.abort();
    }, [reload]);

    const performAndReload = useCallback(async <T,>(
        operation: () => Promise<T>,
        onSuccess?: () => void,
    ): Promise<T | null> => {
        setOperationError(null);
        try {
            const result = await operation();
            onSuccess?.();
            await reload();
            return result;
        } catch (operationFailure) {
            setOperationError(operationFailure instanceof Error
                ? operationFailure.message
                : 'The mental thread could not be changed');
            return null;
        }
    }, [reload]);

    const updateThread = useCallback(async (threadId: string, input: MentalThreadInput) => {
        setOperationError(null);
        const previousThread = threadsRef.current.find(thread => thread.id === threadId);

        if (!previousThread) {
            setOperationError('The mental thread could not be found');
            return null;
        }

        const mutationVersion = (threadMutationVersionsRef.current.get(threadId) ?? 0) + 1;
        threadMutationVersionsRef.current.set(threadId, mutationVersion);

        // Apply the fields that the server will persist before waiting for the
        // network response so state changes are visible immediately.
        const optimisticThread: MentalThread = {
            ...previousThread,
            title: input.title,
            description: input.description,
            attentionState: input.attentionState,
            desiredResolution: input.desiredResolution,
            targetCloseDate: input.targetCloseDate,
            hardDeadlineDate: input.hardDeadlineDate,
            nextReviewDate: input.nextReviewDate,
            currentMentalLoad: input.currentMentalLoad,
        };
        const optimisticThreads = applyThreadToState(threadsRef.current, threadId, optimisticThread);
        threadsRef.current = optimisticThreads;
        setThreads(optimisticThreads);
        setSummary(currentSummary => currentSummary
            ? updateSummaryForThread(currentSummary, previousThread, optimisticThread)
            : currentSummary);

        if (
            previousThread.currentMentalLoad !== optimisticThread.currentMentalLoad
            || previousThread.attentionState !== optimisticThread.attentionState
        ) {
            invalidateMentalThreadHistory(threadId);
        }

        try {
            const updatedThread = await mentalThreadService.updateThread(threadId, input);
            if (threadMutationVersionsRef.current.get(threadId) !== mutationVersion) return updatedThread;

            const nextThreads = applyThreadToState(threadsRef.current, threadId, updatedThread);
            threadsRef.current = nextThreads;
            setThreads(nextThreads);
            setSummary(currentSummary => {
                return currentSummary
                    ? updateSummaryForThread(currentSummary, optimisticThread, updatedThread)
                    : currentSummary;
            });
            return updatedThread;
        } catch (operationFailure) {
            if (threadMutationVersionsRef.current.get(threadId) !== mutationVersion) return optimisticThread;

            const rolledBackThreads = applyThreadToState(threadsRef.current, threadId, previousThread);
            threadsRef.current = rolledBackThreads;
            setThreads(rolledBackThreads);
            setSummary(currentSummary => currentSummary
                ? updateSummaryForThread(currentSummary, optimisticThread, previousThread)
                : currentSummary);
            setOperationError(operationFailure instanceof Error
                ? operationFailure.message
                : 'The mental thread could not be changed');
            return null;
        }
    }, []);

    const closeThread = useCallback((threadId: string, input: CloseMentalThreadInput) => performAndReload(
        () => mentalThreadService.closeThread(threadId, input),
        () => invalidateMentalThreadHistory(threadId),
    ), [performAndReload]);

    const reopenThread = useCallback((threadId: string) => performAndReload(
        () => mentalThreadService.reopenThread(threadId),
        () => invalidateMentalThreadHistory(threadId),
    ), [performAndReload]);

    const deleteThread = useCallback(async (threadId: string) => {
        const result = await performAndReload(
            () => mentalThreadService.deleteThread(threadId),
            () => invalidateMentalThreadHistory(threadId),
        );
        return result !== null;
    }, [performAndReload]);

    const checkInCapacity = useCallback(async (capacity: number) => {
        const previousCapacity = summary?.capacityToday ?? null;
        const mutationVersion = capacityMutationVersionRef.current + 1;
        capacityMutationVersionRef.current = mutationVersion;
        setOperationError(null);
        setSummary(currentSummary => currentSummary
            ? { ...currentSummary, capacityToday: capacity }
            : currentSummary);

        try {
            await mentalThreadService.checkInCapacity(capacity);
            return true;
        } catch (operationFailure) {
            if (capacityMutationVersionRef.current === mutationVersion) {
                setSummary(currentSummary => currentSummary
                    ? { ...currentSummary, capacityToday: previousCapacity }
                    : currentSummary);
                setOperationError(operationFailure instanceof Error
                    ? operationFailure.message
                    : 'The daily capacity could not be changed');
            }
            return false;
        }
    }, [summary?.capacityToday]);

    return {
        threads,
        summary,
        loading,
        error,
        operationError,
        reload,
        clearOperationError: () => setOperationError(null),
        createThread: (input: MentalThreadInput) => performAndReload(() => mentalThreadService.createThread(input)),
        updateThread,
        closeThread,
        reopenThread,
        deleteThread,
        checkInCapacity,
    };
}
