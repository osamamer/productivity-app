import { Task } from '../../types/Task';

export function compareHomeTasks(first: Task, second: Task): number {
    if (first.completed !== second.completed) return first.completed ? 1 : -1;

    // The task snapshot already follows the user's saved order. Returning a tie
    // here lets the stable sort preserve that order instead of moving sibling
    // tasks when their schedule or importance changes.
    return 0;
}

const PRIORITY_WINDOW_MS = 2 * 60 * 60 * 1000;

function orderScheduledTasks(tasks: Task[]): Task[] {
    const chronological = tasks.map(task => ({
        task,
        time: task.scheduledPerformDateTime ? Date.parse(task.scheduledPerformDateTime) : Number.NaN,
    })).sort((first, second) => (Number.isFinite(first.time) ? first.time : Infinity)
        - (Number.isFinite(second.time) ? second.time : Infinity));

    const ordered: Task[] = [];
    // Anchor each window to its earliest task so priority comparisons cannot form a cycle.
    for (let start = 0; start < chronological.length;) {
        let end = start + 1;
        while (end < chronological.length
            && chronological[end].time - chronological[start].time <= PRIORITY_WINDOW_MS) {
            end++;
        }
        ordered.push(...chronological.slice(start, end)
            .sort((first, second) => second.task.importance - first.task.importance)
            .map(({ task }) => task));
        start = end;
    }
    return ordered;
}

export function orderHomeSchedule(tasks: Task[]): Task[] {
    return [
        ...orderScheduledTasks(tasks.filter(task => !task.completed)),
        ...orderScheduledTasks(tasks.filter(task => task.completed)),
    ];
}

type HomeTaskListItem =
    | { kind: 'task'; task: Pick<Task, 'completed'> }
    | { kind: 'group'; tasks: Pick<Task, 'completed'>[] };

function isHomeTaskListItemCompleted(item: HomeTaskListItem): boolean {
    return item.kind === 'task'
        ? item.task.completed
        : item.tasks.length > 0 && item.tasks.every(task => task.completed);
}

type PositionedHomeTaskListItem = {
    item: HomeTaskListItem;
    anchorIndex: number;
    index: number;
};

export function compareHomeTaskListItems(first: PositionedHomeTaskListItem, second: PositionedHomeTaskListItem): number {
    return Number(isHomeTaskListItemCompleted(first.item)) - Number(isHomeTaskListItemCompleted(second.item))
        || first.anchorIndex - second.anchorIndex
        || first.index - second.index;
}
