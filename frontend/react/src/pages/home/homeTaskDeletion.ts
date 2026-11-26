import { mergeTaskDeletionReceipts, taskService } from '../../services/api';
import type { TaskDeletionReceipt } from '../../services/api';
import { Task } from '../../types/Task';
import type { DeleteRequest, DeleteScope } from './homeTypes';

export function requestHasRecurringTasks(request: DeleteRequest): boolean {
    return request.tasks.some(task => Boolean(task.taskSeriesId));
}

export function tasksForDeleteScope(request: DeleteRequest, scope: DeleteScope, allTasks: Task[]): Task[] {
    if (scope === 'occurrence') return request.tasks;

    const selectedTaskIds = new Set(request.tasks.map(task => task.taskId));
    const selectedSeriesIds = new Set(
        request.tasks
            .map(task => task.taskSeriesId)
            .filter((seriesId): seriesId is string => Boolean(seriesId)),
    );
    const affectedTasks = new Map<string, Task>();
    if (scope === 'future') {
        const boundaryBySeries = new Map<string, string>();
        request.tasks.forEach(task => {
            if (!task.taskSeriesId) return;
            const boundary = task.seriesOccurrenceAt ?? task.scheduledPerformDateTime;
            if (!boundary) return;
            const existing = boundaryBySeries.get(task.taskSeriesId);
            if (!existing || boundary < existing) boundaryBySeries.set(task.taskSeriesId, boundary);
        });
        [...request.tasks, ...allTasks].forEach(task => {
            if (!task.taskSeriesId) {
                if (selectedTaskIds.has(task.taskId)) affectedTasks.set(task.taskId, task);
                return;
            }
            const boundary = boundaryBySeries.get(task.taskSeriesId);
            const occurrenceAt = task.seriesOccurrenceAt ?? task.scheduledPerformDateTime;
            if (boundary && occurrenceAt && occurrenceAt > boundary) affectedTasks.set(task.taskId, task);
        });
        return [...affectedTasks.values()];
    }

    request.tasks.forEach(task => affectedTasks.set(task.taskId, task));
    allTasks.forEach(task => {
        if (selectedSeriesIds.has(task.taskSeriesId ?? '')) affectedTasks.set(task.taskId, task);
    });

    return [...affectedTasks.values()].filter(task => (
        selectedTaskIds.has(task.taskId) || selectedSeriesIds.has(task.taskSeriesId ?? '')
    ));
}

export async function deleteTasksForScope(tasks: Task[], scope: DeleteScope): Promise<TaskDeletionReceipt | null> {
    const deletedSeriesIds = new Set<string>();
    const options = { notifyResource: false };
    const operations = tasks.flatMap(task => {
        if ((scope === 'series' || scope === 'future') && task.taskSeriesId) {
            if (deletedSeriesIds.has(task.taskSeriesId)) return [];
            deletedSeriesIds.add(task.taskSeriesId);
            const seriesTasks = tasks.filter(candidate => candidate.taskSeriesId === task.taskSeriesId);
            const boundaryTask = seriesTasks.sort((first, second) => (
                (first.seriesOccurrenceAt ?? first.scheduledPerformDateTime ?? '')
                    .localeCompare(second.seriesOccurrenceAt ?? second.scheduledPerformDateTime ?? '')
            ))[0] ?? task;
            return [() => scope === 'future'
                ? taskService.deleteTaskFutureOccurrences(boundaryTask.taskId, options)
                : taskService.deleteTask(task.taskId, options)];
        }

        return [() => scope === 'occurrence'
            ? taskService.deleteTaskInstance(task, options)
            : taskService.deleteTask(task.taskId, options)];
    });
    const receipts: Array<TaskDeletionReceipt | null> = [];
    try {
        for (const operation of operations) receipts.push(await operation());
    } catch (error) {
        const restorableReceipts = receipts.filter(
            (receipt): receipt is TaskDeletionReceipt => receipt !== null,
        );
        if (restorableReceipts.length > 0) {
            try {
                const restorableReceipt = mergeTaskDeletionReceipts(restorableReceipts);
                if (restorableReceipt) {
                    await taskService.restoreTaskDeletion(restorableReceipt, { notifyResource: false });
                }
            } catch (restoreError) {
                console.error('Could not roll back the completed part of a task deletion:', restoreError);
            }
        }
        throw error;
    }
    return mergeTaskDeletionReceipts(receipts);
}
