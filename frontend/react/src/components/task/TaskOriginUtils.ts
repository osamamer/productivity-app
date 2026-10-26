import type { Task } from '../../types/Task';
import type { TaskGroup } from '../../types/TaskGroup';

export type TaskOriginKind = 'thread' | 'stat';

export function getTaskOriginKind(task: Task, group?: TaskGroup): TaskOriginKind | null {
    if (group?.linkedToMentalThread || task.mentalThreadId) return 'thread';
    if (group?.isStatGroup || task.linkedStatDefinitionId || task.statLinked) return 'stat';
    return null;
}
