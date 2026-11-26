import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Collapse } from '@mui/material';
import { Task } from '../../types/Task';
import { taskListItemContainsTask, taskListItemId } from './homeTaskListItems';
import type { HomeTaskListScope, TaskListItem } from './homeTypes';
import {
    TASK_COMPLETION_REORDER_DURATION_MS,
    TASK_COMPLETION_REORDER_EASING,
    TASK_EXIT_DURATION_MS,
    TASK_REORDER_DURATION_MS,
    TASK_REORDER_EASING,
} from './homeMotion';

export type AnimatedTaskListProps = {
    items: TaskListItem[];
    renderItem: (item: TaskListItem) => React.ReactNode;
    onAnimatingChange?: (animating: boolean) => void;
    animateRemovals?: boolean;
    immediateRemovalTaskIds?: Set<string>;
    entrySource?: { taskId: string; top: number } | null;
    layoutVisibilityKey?: unknown;
    layoutScope: HomeTaskListScope;
    layoutSnapshotRef: React.MutableRefObject<HomeTaskLayoutSnapshot | null>;
};

export type HomeTaskLayoutSnapshot = {
    itemRects: Map<string, DOMRect>;
    taskRectsById: Map<string, DOMRect>;
    completionChange: boolean;
};


export type AnimatedGroupTaskRowsProps = {
    tasks: Task[];
    renderTask: (task: Task) => React.ReactNode;
};

export function AnimatedGroupTaskRows({ tasks, renderTask }: AnimatedGroupTaskRowsProps) {
    const [exitingTasks, setExitingTasks] = useState<Array<{ task: Task; index: number }>>([]);
    const previousTasksRef = useRef(tasks);
    const exitingTasksRef = useRef<Array<{ task: Task; index: number }>>([]);
    const currentTaskIdsRef = useRef(new Set(tasks.map(task => task.taskId)));

    useLayoutEffect(() => {
        const nextTaskIds = new Set(tasks.map(task => task.taskId));
        const previousTasks = previousTasksRef.current;
        const nextExitingTasks = exitingTasksRef.current.filter(({ task }) => !nextTaskIds.has(task.taskId));
        previousTasks.forEach((task, index) => {
            if (!nextTaskIds.has(task.taskId)
                && !nextExitingTasks.some(exiting => exiting.task.taskId === task.taskId)) {
                nextExitingTasks.push({ task, index });
            }
        });

        const exitingChanged = nextExitingTasks.length !== exitingTasksRef.current.length
            || nextExitingTasks.some((exiting, index) => {
                const previous = exitingTasksRef.current[index];
                return !previous || previous.task.taskId !== exiting.task.taskId || previous.index !== exiting.index;
            });
        exitingTasksRef.current = nextExitingTasks;
        previousTasksRef.current = tasks;
        currentTaskIdsRef.current = nextTaskIds;
        if (exitingChanged) setExitingTasks(nextExitingTasks);
    }, [tasks]);

    const currentTaskIdSet = new Set(tasks.map(task => task.taskId));
    const displayedRows = tasks.map(task => ({ task, exiting: false }));
    [...exitingTasks]
        .filter(({ task }) => !currentTaskIdSet.has(task.taskId))
        .sort((first, second) => first.index - second.index)
        .forEach(({ task, index }) => {
            displayedRows.splice(Math.min(index, displayedRows.length), 0, { task, exiting: true });
        });

    return displayedRows.map(({ task, exiting }) => (
        <Collapse
            key={task.taskId}
            in={!exiting}
            timeout={TASK_EXIT_DURATION_MS}
            unmountOnExit
            onExited={() => {
                if (currentTaskIdsRef.current.has(task.taskId)) return;
                const remainingTasks = exitingTasksRef.current.filter(item => item.task.taskId !== task.taskId);
                exitingTasksRef.current = remainingTasks;
                setExitingTasks(remainingTasks);
            }}
        >
            <Box data-task-exiting={exiting ? 'true' : undefined}>
                {renderTask(task)}
            </Box>
        </Collapse>
    ));
}

export function AnimatedTaskList({
    items,
    renderItem,
    onAnimatingChange,
    animateRemovals = true,
    immediateRemovalTaskIds,
    entrySource = null,
    layoutVisibilityKey,
    layoutScope,
    layoutSnapshotRef,
}: AnimatedTaskListProps) {
    const [displayedItems, setDisplayedItems] = useState(items);
    const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(() => new Set());
    const displayedItemsRef = useRef(items);
    const currentItemIdsRef = useRef(new Set(items.map(taskListItemId)));
    const exitingItemIdsRef = useRef(new Set<string>());
    const itemElementsRef = useRef(new Map<string, HTMLDivElement>());
    const previousItemRectsRef = useRef(new Map<string, DOMRect>());
    const previousGroupTaskRectsRef = useRef(new Map<string, Map<string, DOMRect>>());
    const previousTaskRectsByIdRef = useRef(new Map<string, DOMRect>());
    const previousLayoutRef = useRef<{
        itemIds: string[];
        groupTaskIds: Map<string, string[]>;
        taskCompletionById: Map<string, boolean>;
        taskOwnerById: Map<string, string>;
    } | null>(null);
    const previousLayoutSignatureRef = useRef<string | null>(null);
    const animationTimersRef = useRef(new Map<string, number>());

    useLayoutEffect(() => {
        if (!animateRemovals) {
            exitingItemIdsRef.current.clear();
            currentItemIdsRef.current = new Set(items.map(taskListItemId));
            displayedItemsRef.current = items;
            setDisplayedItems(items);
            setExitingItemIds(new Set());
            onAnimatingChange?.(false);
            return;
        }

        const nextItemIdsInOrder = items.map(taskListItemId);
        const nextItemIds = new Set(nextItemIdsInOrder);
        const previousItems = displayedItemsRef.current;
        const previousItemIds = previousItems.map(taskListItemId);
        const sameDisplayedItems = exitingItemIdsRef.current.size === 0
            && previousItemIds.length === nextItemIdsInOrder.length
            && previousItemIds.every((itemId, index) => itemId === nextItemIdsInOrder[index]);

        // A server response can replace the optimistic task payload without
        // changing the list's layout identity. Reconcile that payload in place
        // so the completed entrance transition is not treated as a second add.
        if (sameDisplayedItems) {
            currentItemIdsRef.current = nextItemIds;
            displayedItemsRef.current = items;
            setDisplayedItems(previous => previous === items ? previous : items);
            return;
        }
        const removedItems = previousItems.filter(item => !nextItemIds.has(taskListItemId(item)));
        const immediateRemovalItemIds = new Set(
            removedItems
                .filter(item => immediateRemovalTaskIds && taskListItemContainsTask(item, immediateRemovalTaskIds))
                .map(taskListItemId),
        );
        immediateRemovalItemIds.forEach(itemId => {
            exitingItemIdsRef.current.delete(itemId);
        });
        const reappearedItemIds = items
            .map(taskListItemId)
            .filter(itemId => exitingItemIdsRef.current.has(itemId));

        currentItemIdsRef.current = nextItemIds;
        reappearedItemIds.forEach(itemId => {
            exitingItemIdsRef.current.delete(itemId);
        });
        if (reappearedItemIds.length > 0) {
            setExitingItemIds(new Set(exitingItemIdsRef.current));
            if (exitingItemIdsRef.current.size === 0) onAnimatingChange?.(false);
        }

        // Follow the source order so newly created or reordered tasks appear
        // where the task state puts them. Removed rows are inserted back at
        // their previous slot only while their exit transition is running.
        const animatedRemovedItems = removedItems.filter(
            item => !immediateRemovalItemIds.has(taskListItemId(item)),
        );
        const mergedItems = [...items];
        animatedRemovedItems.forEach(item => {
            const previousIndex = previousItems.findIndex(
                previousItem => taskListItemId(previousItem) === taskListItemId(item),
            );
            mergedItems.splice(Math.min(previousIndex, mergedItems.length), 0, item);
        });
        displayedItemsRef.current = mergedItems;
        if (mergedItems.length !== previousItems.length
            || mergedItems.some((item, index) => item !== previousItems[index])) {
            setDisplayedItems(mergedItems);
        }

        if (immediateRemovalItemIds.size > 0) {
            setExitingItemIds(new Set(exitingItemIdsRef.current));
            if (exitingItemIdsRef.current.size === 0) onAnimatingChange?.(false);
        }

        const newlyRemovedItems = animatedRemovedItems.filter(item => !exitingItemIdsRef.current.has(taskListItemId(item)));
        if (newlyRemovedItems.length > 0) {
            newlyRemovedItems.forEach(item => exitingItemIdsRef.current.add(taskListItemId(item)));
            setExitingItemIds(new Set(exitingItemIdsRef.current));
            onAnimatingChange?.(true);
        }
    }, [animateRemovals, immediateRemovalTaskIds, items, onAnimatingChange]);

    const renderedItems = animateRemovals ? displayedItems : items;
    const layoutSignature = useMemo(
        // Ignore response-only changes so they cannot replay a completed row move.
        () => JSON.stringify(renderedItems.map(item => item.kind === 'task'
            ? [item.renderKey, item.task.taskId, item.task.name, item.task.completed, item.task.tag,
                item.task.scheduledPerformDateTime, item.task.importance]
            : [item.renderKey, item.group.name, item.tasks.map(task => [task.taskId, task.name,
                task.completed, task.tag, task.scheduledPerformDateTime, task.importance])])),
        [renderedItems],
    );

    useLayoutEffect(() => {
        const measureTaskRects = () => {
            const groupTaskRects = new Map<string, Map<string, DOMRect>>();
            const taskRectsById = new Map<string, DOMRect>();
            renderedItems.forEach(item => {
                const itemElement = itemElementsRef.current.get(taskListItemId(item));
                if (!itemElement) return;

                const taskRects = new Map<string, DOMRect>();
                itemElement.querySelectorAll<HTMLElement>('[data-task-id]').forEach(taskElement => {
                    if (taskElement.closest('[data-task-exiting="true"]')) return;
                    const taskId = taskElement.dataset.taskId;
                    if (!taskId) return;
                    const rect = taskElement.getBoundingClientRect();
                    taskRects.set(taskId, rect);
                    taskRectsById.set(taskId, rect);
                });
                if (item.kind === 'group') groupTaskRects.set(item.renderKey, taskRects);
            });
            return { groupTaskRects, taskRectsById };
        };

        const signatureChanged = previousLayoutSignatureRef.current !== layoutSignature;
        if (!signatureChanged) {
            if (animationTimersRef.current.size > 0) return;

            const currentItemRects = new Map<string, DOMRect>();
            renderedItems.forEach(item => {
                const itemId = taskListItemId(item);
                const itemElement = itemElementsRef.current.get(itemId);
                if (!itemElement) return;

                currentItemRects.set(itemId, itemElement.getBoundingClientRect());
            });
            previousItemRectsRef.current = currentItemRects;
            const measuredGroupTaskRects = measureTaskRects();
            previousGroupTaskRectsRef.current = measuredGroupTaskRects.groupTaskRects;
            previousTaskRectsByIdRef.current = measuredGroupTaskRects.taskRectsById;
            return;
        }
        previousLayoutSignatureRef.current = layoutSignature;
        const nextItemIds = renderedItems.map(taskListItemId);
        const nextGroupTaskIds = new Map<string, string[]>(renderedItems
            .filter((item): item is Extract<TaskListItem, { kind: 'group' }> => item.kind === 'group')
            .map(item => [item.renderKey, item.tasks.map(task => task.taskId)] as const));
        const nextTaskCompletionById = new Map<string, boolean>();
        const nextTaskOwnerById = new Map<string, string>();
        renderedItems.forEach(item => {
            if (item.kind === 'task') {
                nextTaskCompletionById.set(item.task.taskId, item.task.completed);
                nextTaskOwnerById.set(item.task.taskId, taskListItemId(item));
            } else {
                item.tasks.forEach(task => {
                    nextTaskCompletionById.set(task.taskId, task.completed);
                    nextTaskOwnerById.set(task.taskId, item.renderKey);
                });
            }
        });
        const previousLayout = previousLayoutRef.current;
        const layoutSnapshot = layoutSnapshotRef.current;
        const completionStatusChanged = layoutSnapshot?.completionChange === true
            || (previousLayout !== null && Array.from(nextTaskCompletionById).some(([taskId, completed]) => (
                previousLayout.taskCompletionById.has(taskId)
                && previousLayout.taskCompletionById.get(taskId) !== completed
            )));
        const layoutAnimationDuration = completionStatusChanged
            ? TASK_COMPLETION_REORDER_DURATION_MS
            : TASK_REORDER_DURATION_MS;
        const layoutAnimationEasing = completionStatusChanged
            ? TASK_COMPLETION_REORDER_EASING
            : TASK_REORDER_EASING;
        const previousItemIdSet = new Set(previousLayout?.itemIds ?? []);
        const nextItemIdSet = new Set(nextItemIds);
        const sameItemSet = previousLayout !== null
            && previousLayout.itemIds.length === nextItemIds.length
            && nextItemIds.every(itemId => previousItemIdSet.has(itemId));
        const sameItemOrder = previousLayout !== null
            && sameItemSet
            && previousLayout.itemIds.every((itemId, index) => itemId === nextItemIds[index]);
        const onlyItemAdditions = previousLayout !== null
            && nextItemIds.length > previousLayout.itemIds.length
            && previousLayout.itemIds.every(itemId => nextItemIdSet.has(itemId));
        const nextItemRects = new Map<string, DOMRect>();
        const nextGroupTaskRects = new Map<string, Map<string, DOMRect>>();
        const nextTaskRectsById = new Map<string, DOMRect>();

        const animateElement = (
            key: string,
            element: HTMLElement,
            previousRect: DOMRect,
            nextRect: DOMRect,
            duration = layoutAnimationDuration,
            easing = layoutAnimationEasing,
        ) => {
            const deltaX = previousRect.left - nextRect.left;
            const deltaY = previousRect.top - nextRect.top;
            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

            const previousTimer = animationTimersRef.current.get(key);
            if (previousTimer !== undefined) window.clearTimeout(previousTimer);
            element.style.transition = 'none';
            element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            element.dataset.homeFlipActive = 'true';
            void element.offsetHeight;
            element.style.transition = `transform ${duration}ms ${easing}`;
            element.style.transform = 'translate3d(0, 0, 0)';
            const timer = window.setTimeout(() => {
                element.style.transition = '';
                element.style.transform = '';
                delete element.dataset.homeFlipActive;
                animationTimersRef.current.delete(key);
            }, duration);
            animationTimersRef.current.set(key, timer);
        };

        const animateEntry = (
            key: string,
            element: HTMLElement,
            sourceTop: number | null = null,
            duration = layoutAnimationDuration,
            easing = layoutAnimationEasing,
        ) => {
            const previousTimer = animationTimersRef.current.get(key);
            if (previousTimer !== undefined) window.clearTimeout(previousTimer);
            const offsetY = sourceTop === null
                ? -6
                : sourceTop - element.getBoundingClientRect().top - window.scrollY;
            element.style.transition = 'none';
            element.style.opacity = sourceTop === null ? '0' : '1';
            element.style.transform = `translate3d(0, ${offsetY}px, 0)`;
            element.dataset.homeFlipActive = 'true';
            void element.offsetHeight;
            element.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ${easing}`;
            element.style.opacity = '1';
            element.style.transform = 'translate3d(0, 0, 0)';
            const timer = window.setTimeout(() => {
                element.style.transition = '';
                element.style.opacity = '';
                element.style.transform = '';
                delete element.dataset.homeFlipActive;
                animationTimersRef.current.delete(key);
            }, duration);
            animationTimersRef.current.set(key, timer);
        };

        renderedItems.forEach(item => {
            const itemId = taskListItemId(item);
            const itemElement = itemElementsRef.current.get(itemId);
            if (!itemElement) return;

            const itemRect = itemElement.getBoundingClientRect();
            nextItemRects.set(itemId, itemRect);
            const previousItemRect = layoutSnapshot?.itemRects.get(itemId)
                ?? previousItemRectsRef.current.get(itemId);
            const itemOrderChanged = sameItemSet && !sameItemOrder;
            if (itemOrderChanged || onlyItemAdditions) {
                if (previousItemRect) animateElement(`item:${itemId}`, itemElement, previousItemRect, itemRect);
                else if (onlyItemAdditions) {
                    const containsReturnTask = item.kind === 'group'
                        && item.tasks.some(task => task.taskId === entrySource?.taskId);
                    if (!containsReturnTask) {
                        const sourceTop = item.kind === 'task' && entrySource?.taskId === item.task.taskId
                            ? entrySource.top
                            : null;
                        animateEntry(`item:${itemId}`, itemElement, sourceTop);
                    }
                }
            }

            if (item.kind === 'task') {
                const taskElement = itemElement.querySelector<HTMLElement>('[data-task-id]');
                const previousOwner = previousLayout?.taskOwnerById.get(item.task.taskId);
                const previousTaskRect = layoutSnapshot?.taskRectsById.get(item.task.taskId)
                    ?? previousTaskRectsByIdRef.current.get(item.task.taskId);
                if (taskElement) {
                    const taskRect = taskElement.getBoundingClientRect();
                    nextTaskRectsById.set(item.task.taskId, taskRect);
                    if (previousOwner && previousOwner !== itemId && previousTaskRect) {
                        animateElement(`task:${item.task.taskId}`, taskElement, previousTaskRect, taskRect);
                    }
                }
                return;
            }

            const groupTaskRects = new Map<string, DOMRect>();
            const previousGroupTaskIds = previousLayout?.groupTaskIds.get(itemId) ?? [];
            const nextGroupTaskIdsForItem = nextGroupTaskIds.get(itemId) ?? [];
            const nextGroupTaskIdSet = new Set(nextGroupTaskIdsForItem);
            const groupTaskOrderChanged = previousGroupTaskIds.length === nextGroupTaskIdsForItem.length
                && previousGroupTaskIds.some((taskId, index) => taskId !== nextGroupTaskIdsForItem[index]);
            const onlyGroupTaskAdditions = previousGroupTaskIds.length > 0
                && nextGroupTaskIdsForItem.length > previousGroupTaskIds.length
                && previousGroupTaskIds.every(taskId => nextGroupTaskIdSet.has(taskId));
            const previousGroupTaskIdSet = new Set(previousGroupTaskIds);
            const onlyGroupTaskRemovals = nextGroupTaskIdsForItem.length > 0
                && nextGroupTaskIdsForItem.length < previousGroupTaskIds.length
                && nextGroupTaskIdsForItem.every(taskId => previousGroupTaskIdSet.has(taskId));
            const groupTaskLayoutChanged = groupTaskOrderChanged || onlyGroupTaskAdditions || onlyGroupTaskRemovals;
            const groupMoved = previousItemRect !== undefined
                && (Math.abs(previousItemRect.left - itemRect.left) >= 1
                    || Math.abs(previousItemRect.top - itemRect.top) >= 1);
            const previousGroupTaskRects = previousGroupTaskRectsRef.current.get(itemId);
            const groupCompletionChanged = nextGroupTaskIdsForItem.some(taskId => (
                previousLayout?.taskCompletionById.has(taskId)
                && previousLayout.taskCompletionById.get(taskId) !== nextTaskCompletionById.get(taskId)
            ));
            const taskAnimationDuration = groupCompletionChanged
                ? TASK_COMPLETION_REORDER_DURATION_MS
                : TASK_REORDER_DURATION_MS;
            const taskAnimationEasing = groupCompletionChanged
                ? TASK_COMPLETION_REORDER_EASING
                : TASK_REORDER_EASING;

            itemElement.querySelectorAll<HTMLElement>('[data-task-id]').forEach(taskElement => {
                if (taskElement.closest('[data-task-exiting="true"]')) return;
                const taskId = taskElement.dataset.taskId;
                if (!taskId) return;
                const taskRect = taskElement.getBoundingClientRect();
                groupTaskRects.set(taskId, taskRect);
                nextTaskRectsById.set(taskId, taskRect);
                const previousTaskRect = layoutSnapshot?.taskRectsById.get(taskId)
                    ?? previousTaskRectsByIdRef.current.get(taskId)
                    ?? previousGroupTaskRects?.get(taskId);
                const isReturnEntry = entrySource?.taskId === taskId && !previousTaskRect;
                const previousOwner = previousLayout?.taskOwnerById.get(taskId);
                if (isReturnEntry) {
                    animateEntry(`task:${taskId}`, taskElement, entrySource.top, taskAnimationDuration, taskAnimationEasing);
                } else if (previousOwner && previousOwner !== itemId && previousTaskRect) {
                    animateElement(`task:${taskId}`, taskElement, previousTaskRect, taskRect,
                        taskAnimationDuration, taskAnimationEasing);
                } else if (sameItemOrder && !groupMoved && groupTaskLayoutChanged) {
                    if (previousTaskRect) {
                        animateElement(`task:${taskId}`, taskElement, previousTaskRect, taskRect,
                            taskAnimationDuration, taskAnimationEasing);
                    } else if (onlyGroupTaskAdditions) {
                        animateEntry(`task:${taskId}`, taskElement, null, taskAnimationDuration, taskAnimationEasing);
                    }
                }
            });
            nextGroupTaskRects.set(itemId, groupTaskRects);
        });

        previousLayoutRef.current = {
            itemIds: nextItemIds,
            groupTaskIds: nextGroupTaskIds,
            taskCompletionById: nextTaskCompletionById,
            taskOwnerById: nextTaskOwnerById,
        };
        previousItemRectsRef.current = nextItemRects;
        previousGroupTaskRectsRef.current = nextGroupTaskRects;
        previousTaskRectsByIdRef.current = nextTaskRectsById;
        if (layoutSnapshotRef.current === layoutSnapshot) layoutSnapshotRef.current = null;
    }, [entrySource, layoutSignature, layoutSnapshotRef, layoutVisibilityKey, renderedItems]);

    useEffect(() => () => {
        animationTimersRef.current.forEach(timer => window.clearTimeout(timer));
        animationTimersRef.current.clear();
    }, []);

    return (
        <>
            {renderedItems.map(item => {
                const itemId = taskListItemId(item);
                const exiting = animateRemovals && exitingItemIds.has(itemId);
                return (
                    <Collapse
                        key={itemId}
                        in={!exiting}
                        timeout={TASK_EXIT_DURATION_MS}
                        easing={{
                            enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
                            exit: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        unmountOnExit
                        onExited={() => {
                            if (currentItemIdsRef.current.has(itemId)) return;

                            exitingItemIdsRef.current.delete(itemId);
                            setExitingItemIds(new Set(exitingItemIdsRef.current));
                            const remainingItems = displayedItemsRef.current.filter(
                                displayedItem => taskListItemId(displayedItem) !== itemId,
                            );
                            displayedItemsRef.current = remainingItems;
                            setDisplayedItems(remainingItems);
                            if (exitingItemIdsRef.current.size === 0) onAnimatingChange?.(false);
                        }}
                    >
                        <Box
                            ref={(element: HTMLDivElement | null) => {
                                if (element) itemElementsRef.current.set(itemId, element);
                                else itemElementsRef.current.delete(itemId);
                            }}
                            data-home-task-layout-scope={layoutScope}
                            data-home-task-layout-item={itemId}
                            data-home-list-exiting={exiting ? 'true' : undefined}
                            sx={{
                                opacity: exiting ? 0 : 1,
                                transform: exiting ? 'translateY(-4px)' : 'translateY(0)',
                                transition: `opacity ${TASK_EXIT_DURATION_MS}ms ease-out, transform ${TASK_EXIT_DURATION_MS}ms ease-out`,
                            }}
                        >
                            {renderItem(item)}
                        </Box>
                    </Collapse>
                );
            })}
        </>
    );
}
