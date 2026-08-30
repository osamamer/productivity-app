import { useCallback, useEffect, useState } from 'react';
import {
    CloseMentalThreadInput,
    MentalThread,
    MentalThreadInput,
    MentalThreadSummary,
} from '../types/MentalThread.ts';
import { mentalThreadService } from '../services/api/mentalThreadService.ts';
import { invalidateMentalThreadHistory } from '../services/cache/mentalThreadHistoryCache.ts';

export function useMentalThreadsWorkspace() {
    const [threads, setThreads] = useState<MentalThread[]>([]);
    const [summary, setSummary] = useState<MentalThreadSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);

    const reload = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const [loadedThreads, loadedSummary] = await Promise.all([
                mentalThreadService.getThreads(true, signal),
                mentalThreadService.getSummary(signal),
            ]);
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

    const updateThread = useCallback((threadId: string, input: MentalThreadInput) => performAndReload(
        () => mentalThreadService.updateThread(threadId, input),
        () => invalidateMentalThreadHistory(threadId),
    ), [performAndReload]);

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
        const result = await performAndReload(() => mentalThreadService.checkInCapacity(capacity));
        return result !== null;
    }, [performAndReload]);

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
