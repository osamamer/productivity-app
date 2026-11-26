import { useCallback, useRef } from 'react';
import type { HomeTaskLayoutSnapshot } from './AnimatedTaskList';
import { TASK_COMPLETION_REORDER_DURATION_MS } from './homeMotion';

function emptySnapshot(): HomeTaskLayoutSnapshot {
    return { itemRects: new Map(), taskRectsById: new Map(), completionChange: true };
}

/**
 * Records where every Home row is before a completion change, so the today and older lists can
 * animate rows from those positions. A snapshot expires once the reorder animation would be over.
 */
export function useHomeTaskLayoutSnapshot() {
    const todayLayoutSnapshotRef = useRef<HomeTaskLayoutSnapshot | null>(null);
    const olderLayoutSnapshotRef = useRef<HomeTaskLayoutSnapshot | null>(null);

    const captureHomeTaskLayout = useCallback(() => {
        const todaySnapshot = emptySnapshot();
        const olderSnapshot = emptySnapshot();

        document.querySelectorAll<HTMLElement>(
            '[data-home-task-layout-scope][data-home-task-layout-item]',
        ).forEach(itemElement => {
            if (itemElement.dataset.homeListExiting === 'true') return;
            const snapshot = itemElement.dataset.homeTaskLayoutScope === 'older' ? olderSnapshot : todaySnapshot;
            const itemId = itemElement.dataset.homeTaskLayoutItem;
            if (!itemId) return;

            snapshot.itemRects.set(itemId, itemElement.getBoundingClientRect());
            itemElement.querySelectorAll<HTMLElement>('[data-task-id]').forEach(taskElement => {
                if (taskElement.closest('[data-task-exiting="true"]')) return;
                const taskId = taskElement.dataset.taskId;
                if (taskId) snapshot.taskRectsById.set(taskId, taskElement.getBoundingClientRect());
            });
        });

        todayLayoutSnapshotRef.current = todaySnapshot;
        olderLayoutSnapshotRef.current = olderSnapshot;
        window.setTimeout(() => {
            if (todayLayoutSnapshotRef.current === todaySnapshot) todayLayoutSnapshotRef.current = null;
            if (olderLayoutSnapshotRef.current === olderSnapshot) olderLayoutSnapshotRef.current = null;
        }, TASK_COMPLETION_REORDER_DURATION_MS + 80);

        // Settle any running row animation so the next one starts from the measured spot.
        document.querySelectorAll<HTMLElement>('[data-home-flip-active="true"]').forEach(element => {
            element.style.transition = 'none';
            element.style.transform = '';
            delete element.dataset.homeFlipActive;
            void element.offsetHeight;
            element.style.transition = '';
        });
    }, []);

    return { captureHomeTaskLayout, todayLayoutSnapshotRef, olderLayoutSnapshotRef };
}
