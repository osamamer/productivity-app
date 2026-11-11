import { Task } from '../../types/Task';

export function compareHomeTasks(first: Task, second: Task): number {
    if (first.completed !== second.completed) return first.completed ? 1 : -1;

    // The task snapshot already follows the user's saved order. Returning a tie
    // here lets the stable sort preserve that order instead of moving sibling
    // tasks when their schedule or importance changes.
    return 0;
}
