import { Task } from '../../types/Task.tsx';
import { TaskGroup } from '../../types/TaskGroup';
import { StatDefinition } from '../../types/Stats';
import { StatGroup } from '../../types/StatGroup';

export function buildStatTaskGroups(
    tasks: Task[],
    taskGroups: TaskGroup[],
    statGroups: StatGroup[],
    definitions: StatDefinition[],
): TaskGroup[] {
    const alreadyGroupedTaskIds = new Set(taskGroups.flatMap(group => group.taskIds));
    const definitionsBySeriesId = new Map(
        definitions
            .filter(definition => definition.recurringTaskSeriesId)
            .map(definition => [definition.recurringTaskSeriesId!, definition]),
    );
    const tasksByStatGroupId = new Map<string, Task[]>();
    const orderedStatGroups = [...statGroups].sort((first, second) => first.displayOrder - second.displayOrder);

    tasks.forEach(task => {
        if (task.parentId || alreadyGroupedTaskIds.has(task.taskId)) return;

        const linkedDefinitionIds = new Set<string>();
        if (task.linkedStatDefinitionId) linkedDefinitionIds.add(task.linkedStatDefinitionId);

        const recurringDefinition = task.taskSeriesId
            ? definitionsBySeriesId.get(task.taskSeriesId)
            : undefined;
        if (recurringDefinition) linkedDefinitionIds.add(recurringDefinition.id);

        const taskName = task.name.trim().toLowerCase();
        if (taskName) {
            definitions.forEach(definition => {
                if (definition.recurringTaskSeriesId) return;
                const linkedNames = [definition.focusTaskName, ...(definition.focusTaskNames ?? [])];
                if (linkedNames.some(name => name?.trim().toLowerCase() === taskName)) {
                    linkedDefinitionIds.add(definition.id);
                }
            });
        }

        const matchingGroup = orderedStatGroups.find(group => (
            group.statDefinitionIds.some(definitionId => linkedDefinitionIds.has(definitionId))
        ));
        if (!matchingGroup) return;

        const groupTasks = tasksByStatGroupId.get(matchingGroup.groupId);
        if (groupTasks) groupTasks.push(task);
        else tasksByStatGroupId.set(matchingGroup.groupId, [task]);
    });

    return orderedStatGroups.flatMap(statGroup => {
        const groupTasks = tasksByStatGroupId.get(statGroup.groupId) ?? [];
        if (groupTasks.length < 2) return [];
        return [{
            groupId: `stat-group:${statGroup.groupId}`,
            name: statGroup.name,
            taskIds: groupTasks.map(task => task.taskId),
            displayOrder: statGroup.displayOrder,
            isStatGroup: true,
        }];
    });
}

export type TaskListItem =
    | { kind: 'task'; task: Task }
    | { kind: 'group'; group: TaskGroup; tasks: Task[] };

export function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
    const visibleTaskIds = new Set(tasks.map(task => task.taskId));
    const groupByTaskId = new Map<string, TaskGroup>();
    const tasksByGroupId = new Map<string, Task[]>();
    [...groups]
        .map(group => group.linkedToMentalThread || group.taskIds.some(taskId => (
            tasks.some(task => task.taskId === taskId && Boolean(task.mentalThreadId))
        )) ? { ...group, linkedToMentalThread: true } : group)
        .filter(group => group.taskIds.length >= 2 || group.linkedToMentalThread)
        .sort((first, second) => first.displayOrder - second.displayOrder)
        .forEach(group => group.taskIds.forEach(taskId => {
            if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) groupByTaskId.set(taskId, group);
        }));

    tasks.forEach(task => {
        const groupId = groupByTaskId.get(task.taskId)?.groupId;
        if (!groupId) return;
        const groupTasks = tasksByGroupId.get(groupId);
        if (groupTasks) groupTasks.push(task);
        else tasksByGroupId.set(groupId, [task]);
    });

    const emittedGroupIds = new Set<string>();
    return tasks.reduce<TaskListItem[]>((items, task) => {
        const group = groupByTaskId.get(task.taskId);
        if (!group) {
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
