import { Task } from '../../types/Task';
import { TaskGroup } from '../../types/TaskGroup';
import { shouldRenderTaskGroup } from '../../components/task-page/taskPageSectionUtils';
import { compareHomeTaskListItems } from '../../services/utils/homeTaskOrdering';
import { groupExpansionId } from './homeGroupExpansion';
import type { HomeTaskListScope, TaskListItem } from './homeTypes';

export function buildTaskListItems(
    tasks: Task[],
    groups: TaskGroup[],
    getTaskRenderKey: (taskId: string) => string,
    scope: HomeTaskListScope,
    anchorTasks: Task[] = tasks,
): TaskListItem[] {
    const visibleTaskIds = new Set(tasks.map(task => task.taskId));
    const anchorIndexByTaskId = new Map(anchorTasks.map((task, index) => [task.taskId, index] as const));
    const groupByTaskId = new Map<string, TaskGroup>();
    const tasksByGroupId = new Map<string, Task[]>();

    groups
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .forEach(group => group.taskIds.forEach(taskId => {
            if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) {
                groupByTaskId.set(taskId, group);
            }
        }));

    tasks.forEach(task => {
        const groupId = groupByTaskId.get(task.taskId)?.groupId;
        if (!groupId) return;
        const groupTasks = tasksByGroupId.get(groupId);
        if (groupTasks) groupTasks.push(task);
        else tasksByGroupId.set(groupId, [task]);
    });

    const emittedGroupIds = new Set<string>();
    const items: TaskListItem[] = [];

    tasks.forEach(task => {
        const group = groupByTaskId.get(task.taskId);
        if (!group) {
            items.push({
                kind: 'task',
                task,
                renderKey: getTaskRenderKey(task.taskId),
            });
            return;
        }
        if (emittedGroupIds.has(group.groupId)) return;

        emittedGroupIds.add(group.groupId);
        const groupTasks = tasksByGroupId.get(group.groupId) ?? [];
        if (groupTasks.length > 0 && !shouldRenderTaskGroup(groupTasks)) {
            const singletonTask = groupTasks[0];
            items.push({
                kind: 'task',
                task: singletonTask,
                renderKey: getTaskRenderKey(singletonTask.taskId),
            });
            return;
        }

        items.push({
            kind: 'group',
            group,
            tasks: groupTasks,
            renderKey: `group:${group.groupId}`,
            expansionId: groupExpansionId(group, scope),
        });
    });

    return items
        .map((item, index) => {
            const anchorIndex = item.kind === 'task'
                ? anchorIndexByTaskId.get(item.task.taskId)
                : item.group.taskIds
                    .map(taskId => anchorIndexByTaskId.get(taskId))
                    .filter((taskIndex): taskIndex is number => taskIndex !== undefined)
                    .reduce<number | undefined>(
                        (earliest, taskIndex) => earliest === undefined ? taskIndex : Math.min(earliest, taskIndex),
                        undefined,
                    );
            return { item, index, anchorIndex: anchorIndex ?? index };
        })
        .sort(compareHomeTaskListItems)
        .map(({ item }) => item);
}

export function taskListItemId(item: TaskListItem): string {
    return item.renderKey;
}

export function taskListItemContainsTask(item: TaskListItem, taskIds: Set<string>): boolean {
    if (item.kind === 'task') return taskIds.has(item.task.taskId);
    return item.tasks.some(task => taskIds.has(task.taskId))
        || item.group.taskIds.some(taskId => taskIds.has(taskId));
}
