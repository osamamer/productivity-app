import { TaskGroup } from '../../types/TaskGroup';
import type { HomeTaskListScope } from './homeTypes';

export function groupExpansionId(group: TaskGroup, scope: HomeTaskListScope): string {
    return group.isStatGroup ? `stat-group:${scope}:${group.groupId}` : group.groupId;
}

export function collapsedHomeGroupIds(groups: TaskGroup[]): Set<string> {
    return new Set(groups.flatMap(group => group.isStatGroup
        ? [groupExpansionId(group, 'today'), groupExpansionId(group, 'older')]
        : [group.groupId]));
}

export function reconcileCollapsedHomeGroupIds(
    previousCollapsed: Set<string>,
    previousGroups: TaskGroup[],
    nextGroups: TaskGroup[],
): Set<string> {
    const knownExpansionIds = new Set(previousGroups.flatMap(group => group.isStatGroup
        ? [groupExpansionId(group, 'today'), groupExpansionId(group, 'older')]
        : [group.groupId]));
    const nextCollapsed = new Set<string>();

    nextGroups.forEach(group => {
        const expansionIds = group.isStatGroup
            ? [groupExpansionId(group, 'today'), groupExpansionId(group, 'older')]
            : [group.groupId];
        expansionIds.forEach(expansionId => {
            if (!knownExpansionIds.has(expansionId) || previousCollapsed.has(expansionId)) {
                nextCollapsed.add(expansionId);
            }
        });
    });

    return nextCollapsed;
}
