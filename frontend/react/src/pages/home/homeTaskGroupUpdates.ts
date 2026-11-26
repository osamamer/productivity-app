import { TaskGroup } from '../../types/TaskGroup';

export function sameTaskGroup(first: TaskGroup, second: TaskGroup): boolean {
    return first.groupId === second.groupId
        && first.name === second.name
        && first.displayOrder === second.displayOrder
        && first.linkedToMentalThread === second.linkedToMentalThread
        && first.taskIds.length === second.taskIds.length
        && first.taskIds.every((taskId, index) => taskId === second.taskIds[index]);
}

export function replaceTaskGroupIfChanged(
    previous: TaskGroup[] | null,
    updatedGroup: TaskGroup,
): TaskGroup[] | null {
    if (!previous) return previous;

    let changed = false;
    const next = previous.map(existingGroup => {
        if (existingGroup.groupId !== updatedGroup.groupId || sameTaskGroup(existingGroup, updatedGroup)) {
            return existingGroup;
        }

        changed = true;
        return updatedGroup;
    });

    return changed ? next : previous;
}

export function replaceTaskIdInGroup(
    previous: TaskGroup[] | null,
    groupId: string,
    previousTaskId: string,
    nextTaskId: string,
): TaskGroup[] | null {
    if (!previous) return previous;

    let changed = false;
    const next = previous.map(group => {
        if (group.groupId !== groupId || !group.taskIds.includes(previousTaskId)) return group;

        changed = true;
        return {
            ...group,
            taskIds: group.taskIds.map(taskId => taskId === previousTaskId ? nextTaskId : taskId),
        };
    });

    return changed ? next : previous;
}

export function removeTaskIdFromGroup(
    previous: TaskGroup[] | null,
    groupId: string,
    taskId: string,
): TaskGroup[] | null {
    if (!previous) return previous;

    let changed = false;
    const next = previous.map(group => {
        if (group.groupId !== groupId || !group.taskIds.includes(taskId)) return group;

        changed = true;
        return { ...group, taskIds: group.taskIds.filter(candidate => candidate !== taskId) };
    });

    return changed ? next : previous;
}
