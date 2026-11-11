import { Task } from '../../types/Task';

export function reconcileTaskSnapshot(previous: Task[], next: Task[]): Task[] {
    const previousById = new Map(previous.map(task => [task.taskId, task]));
    let recordChanged = previous.length !== next.length;
    const reconciled = next.map(task => {
        const previousTask = previousById.get(task.taskId);
        if (!previousTask || JSON.stringify(previousTask) !== JSON.stringify(task)) {
            recordChanged = true;
            return task;
        }
        return previousTask;
    });
    const orderChanged = previous.length !== reconciled.length
        || previous.some((task, index) => task.taskId !== reconciled[index]?.taskId);
    return recordChanged || orderChanged ? reconciled : previous;
}
