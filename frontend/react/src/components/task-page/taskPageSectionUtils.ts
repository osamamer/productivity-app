import { Task } from '../../types/Task.tsx';
import { TaskGroup } from '../../types/TaskGroup';
export type TaskListItem =
    | { kind: 'task'; task: Task }
    | { kind: 'group'; group: TaskGroup; tasks: Task[] };

export function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
    const tasksById = new Map<string, Task>();
    tasks.forEach(task => tasksById.set(task.taskId, task));
    const uniqueTasks = [...tasksById.values()];
    const visibleTaskIds = new Set(uniqueTasks.map(task => task.taskId));
    const groupByTaskId = new Map<string, TaskGroup>();
    const tasksByGroupId = new Map<string, Task[]>();
    const groupCandidates = [...groups]
        .filter(group => group.taskIds.length >= 2 || group.linkedToMentalThread || group.isStatGroup)
        .sort((first, second) => first.displayOrder - second.displayOrder);

    groupCandidates.forEach(group => {
        group.taskIds.forEach(taskId => {
            if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) groupByTaskId.set(taskId, group);
        });
    });

    uniqueTasks.forEach(task => {
        const groupId = groupByTaskId.get(task.taskId)?.groupId;
        if (!groupId) return;
        const groupTasks = tasksByGroupId.get(groupId);
        if (groupTasks) groupTasks.push(task);
        else tasksByGroupId.set(groupId, [task]);
    });

    const singletonLinkedGroups = new Map<string, TaskGroup>();
    groupCandidates.forEach(group => {
        if (!group.linkedToMentalThread && !group.isStatGroup) return;
        const groupTasks = tasksByGroupId.get(group.groupId) ?? [];
        if (groupTasks.length === 1) singletonLinkedGroups.set(groupTasks[0].taskId, group);
    });

    const emittedGroupIds = new Set<string>();
    return uniqueTasks.reduce<TaskListItem[]>((items, task) => {
        const group = groupByTaskId.get(task.taskId);
        const singletonGroup = singletonLinkedGroups.get(task.taskId);
        if (!group) {
            items.push({ kind: 'task', task });
        } else if (singletonGroup?.groupId === group.groupId) {
            items.push({ kind: 'task', task });
        } else if (!emittedGroupIds.has(group.groupId)) {
            emittedGroupIds.add(group.groupId);
            items.push({
                kind: 'group',
                group,
                tasks: tasksByGroupId.get(group.groupId) ?? [],
            });
        }
        return items;
    }, []);
}
