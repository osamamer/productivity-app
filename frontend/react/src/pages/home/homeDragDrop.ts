import React from 'react';
import { TaskGroup } from '../../types/TaskGroup';
import type { DropEdge, GroupDropIntent, GroupTaskDropPlacement } from './homeTypes';

export function taskDropEdge(event: React.DragEvent<HTMLElement>): DropEdge {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}

export function dropIntent(event: React.DragEvent<HTMLElement>): GroupDropIntent {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    if (relativeY < 0.32) return 'before';
    if (relativeY > 0.68) return 'after';
    return 'inside';
}

export function isDragOverTask(event: React.DragEvent<HTMLElement>): boolean {
    const target = event.target;
    return target instanceof Element && target.closest('[data-task-id]') !== null;
}

export function groupTaskDropPlacement(
    event: React.DragEvent<HTMLElement>,
    group: TaskGroup,
): GroupTaskDropPlacement | null {
    const groupTaskIdSet = new Set(group.taskIds);
    const taskRows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-task-id]'))
        .filter(row => groupTaskIdSet.has(row.dataset.taskId ?? ''))
        .sort((first, second) => first.getBoundingClientRect().top - second.getBoundingClientRect().top);
    if (taskRows.length === 0) return null;

    for (const taskRow of taskRows) {
        const bounds = taskRow.getBoundingClientRect();
        if (event.clientY < bounds.top + bounds.height / 2) {
            return { targetTaskId: taskRow.dataset.taskId!, edge: 'before' };
        }
    }

    return { targetTaskId: taskRows[taskRows.length - 1].dataset.taskId!, edge: 'after' };
}
