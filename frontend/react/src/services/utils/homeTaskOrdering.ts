import { Task } from '../../types/Task';

export function compareHomeTasks(first: Task, second: Task): number {
    if (first.completed !== second.completed) return first.completed ? 1 : -1;

    // The task snapshot already follows the user's saved order. Returning a tie
    // here lets the stable sort preserve that order instead of moving sibling
    // tasks when their schedule or importance changes.
    return 0;
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
