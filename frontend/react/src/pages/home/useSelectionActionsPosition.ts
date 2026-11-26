import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
    SELECTION_ACTIONS_EDGE_PADDING,
    SELECTION_ACTIONS_FALLBACK_WIDTH,
    SELECTION_ACTIONS_GAP,
} from './homeMotion';

type Position = { top: number; left: number };

/**
 * Places the floating bulk-action bar beside the selected rows, centred on them vertically and
 * kept inside the window. It follows scrolling, resizing and rows changing height.
 * `layoutKey` should change whenever rows may have moved without the selection changing.
 */
export function useSelectionActionsPosition(
    visible: boolean,
    selectedTaskIds: ReadonlySet<string>,
    selectedGroupIds: ReadonlySet<string>,
    layoutKey: readonly unknown[],
) {
    const [position, setPosition] = useState<Position | null>(null);
    const actionsRef = useRef<HTMLDivElement | null>(null);

    const updatePosition = useCallback(() => {
        if (!visible) return;

        const selectedRows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
            .filter(row => selectedTaskIds.has(row.dataset.taskId ?? ''));
        const selectedGroupRows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-group-id]'))
            .filter(row => selectedGroupIds.has(row.dataset.taskGroupId ?? ''));
        const rows = [...selectedRows, ...selectedGroupRows];
        if (rows.length === 0) {
            setPosition(null);
            return;
        }

        const bounds = rows.map(row => row.getBoundingClientRect());
        const rowCenters = bounds.map(rect => rect.top + rect.height / 2);
        const top = (Math.min(...rowCenters) + Math.max(...rowCenters)) / 2;
        const right = Math.max(...bounds.map(rect => rect.right));
        const popupWidth = actionsRef.current?.getBoundingClientRect().width ?? SELECTION_ACTIONS_FALLBACK_WIDTH;
        const maxLeft = window.innerWidth - popupWidth - SELECTION_ACTIONS_EDGE_PADDING;
        const left = Math.min(
            Math.max(right + SELECTION_ACTIONS_GAP, SELECTION_ACTIONS_EDGE_PADDING),
            Math.max(SELECTION_ACTIONS_EDGE_PADDING, maxLeft),
        );
        const next = { top: Math.round(top), left: Math.round(left) };
        setPosition(previous => previous?.top === next.top && previous.left === next.left ? previous : next);
    }, [selectedGroupIds, selectedTaskIds, visible]);

    useLayoutEffect(() => {
        if (!visible) return undefined;

        updatePosition();
        const handleViewportChange = () => updatePosition();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleViewportChange);
        if (resizeObserver) {
            document.querySelectorAll<HTMLElement>('[data-task-id]').forEach(row => {
                if (selectedTaskIds.has(row.dataset.taskId ?? '')
                    || selectedGroupIds.has(row.dataset.taskGroupId ?? '')) resizeObserver.observe(row);
            });
            document.querySelectorAll<HTMLElement>('[data-task-group-id]').forEach(row => {
                if (selectedGroupIds.has(row.dataset.taskGroupId ?? '')) resizeObserver.observe(row);
            });
        }

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            resizeObserver?.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutKey lists what moves rows
    }, [selectedGroupIds, selectedTaskIds, updatePosition, visible, ...layoutKey]);

    return { position, actionsRef };
}
