import type { StatDefinition } from '../../types/Stats';
import type { Task } from '../../types/Task';

function linkedDefinitions(task: Task, definitions: StatDefinition[]): StatDefinition[] {
    const taskName = task.name.trim().toLowerCase();

    return definitions.filter(definition => {
        if (task.linkedStatDefinitionId === definition.id) return true;
        if (task.taskSeriesId && task.taskSeriesId === definition.recurringTaskSeriesId) return true;
        if (!taskName || definition.recurringTaskSeriesId) return false;

        return [definition.focusTaskName, ...(definition.focusTaskNames ?? [])]
            .some(name => name?.trim().toLowerCase() === taskName);
    });
}

export function isCalendarStatTaskVisible(
    task: Task,
    definitions: StatDefinition[],
    selectedStatIds: ReadonlySet<string>,
    showStatTasks: boolean,
): boolean {
    const matches = linkedDefinitions(task, definitions);
    const isStatLinked = task.statLinked === true
        || Boolean(task.linkedStatDefinitionId)
        || matches.length > 0;

    if (!isStatLinked) return true;
    if (!showStatTasks) return false;
    if (matches.length === 0) return true;
    return matches.some(definition => selectedStatIds.has(definition.id));
}

export function isCalendarDailyTaskVisible(task: Task, showDailyRecurringTasks: boolean): boolean {
    return showDailyRecurringTasks || task.recurrenceFrequency !== 'DAILY';
}
