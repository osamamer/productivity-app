import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingUndo, TaskFeedback } from './homeTypes';

const UNDO_WINDOW_MS = 5000;

/**
 * Home's single feedback message. At most one undo is pending: showing a new one commits the
 * previous action, and leaving Home commits whatever is still waiting.
 */
export function useTaskFeedback() {
    const [taskFeedback, setTaskFeedback] = useState<TaskFeedback | null>(null);
    const taskFeedbackIdRef = useRef(0);
    const pendingUndoRef = useRef<PendingUndo | null>(null);

    const showTaskFeedback = useCallback((severity: TaskFeedback['severity'], message: string) => {
        taskFeedbackIdRef.current += 1;
        setTaskFeedback({ id: taskFeedbackIdRef.current, severity, message });
    }, []);

    const showUndoFeedback = useCallback((
        message: string,
        undo: () => void | Promise<void>,
        commit: () => void | Promise<void> = () => {},
        severity: TaskFeedback['severity'] = 'success',
    ) => {
        const previousUndo = pendingUndoRef.current;
        if (previousUndo) {
            window.clearTimeout(previousUndo.timeoutId);
            void previousUndo.commit();
        }

        const timeoutId = window.setTimeout(() => {
            if (pendingUndoRef.current?.timeoutId !== timeoutId) return;
            pendingUndoRef.current = null;
            setTaskFeedback(previous => previous?.undo === undo ? null : previous);
            void commit();
        }, UNDO_WINDOW_MS);
        pendingUndoRef.current = { timeoutId, commit };
        taskFeedbackIdRef.current += 1;
        setTaskFeedback({ id: taskFeedbackIdRef.current, severity, message, undo });
    }, []);

    const undoTaskFeedback = useCallback(async () => {
        const undo = taskFeedback?.undo;
        const pendingUndo = pendingUndoRef.current;
        if (!undo) return;
        if (pendingUndo) window.clearTimeout(pendingUndo.timeoutId);
        pendingUndoRef.current = null;
        setTaskFeedback(null);
        try {
            await undo();
        } catch (error) {
            console.error('Error undoing Home task action:', error);
            showTaskFeedback('error', 'Could not undo that action');
        }
    }, [showTaskFeedback, taskFeedback]);

    const dismissTaskFeedback = useCallback(() => setTaskFeedback(null), []);

    useEffect(() => () => {
        const pendingUndo = pendingUndoRef.current;
        if (!pendingUndo) return;
        window.clearTimeout(pendingUndo.timeoutId);
        pendingUndoRef.current = null;
        void pendingUndo.commit();
    }, []);

    return { taskFeedback, showTaskFeedback, showUndoFeedback, undoTaskFeedback, dismissTaskFeedback };
}
