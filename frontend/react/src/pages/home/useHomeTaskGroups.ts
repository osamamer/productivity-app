import { useCallback, useEffect, useRef, useState } from 'react';
import { taskGroupService } from '../../services/api';
import { subscribeToAppRefresh } from '../../services/utils/appRefresh';
import type { TaskGroup } from '../../types/TaskGroup';
import { collapsedHomeGroupIds, reconcileCollapsedHomeGroupIds } from './homeGroupExpansion';

/**
 * Task groups for Home and which of them are collapsed. Groups start from the service cache,
 * refresh on mount and on the app heartbeat, and new groups arrive collapsed.
 * `groups` is null until the first answer when nothing was cached.
 */
export function useHomeTaskGroups() {
    const [cachedGroups] = useState(() => taskGroupService.getCachedGroups());
    const [groups, setGroups] = useState<TaskGroup[] | null>(() => cachedGroups ?? null);
    const groupsRef = useRef(groups);
    groupsRef.current = groups;
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
        () => collapsedHomeGroupIds(cachedGroups ?? []),
    );

    const refreshGroups = useCallback(async (forceRefresh = false) => {
        try {
            const fetchedGroups = await taskGroupService.getGroups(forceRefresh);
            const previousGroups = groupsRef.current ?? [];
            groupsRef.current = fetchedGroups;
            setGroups(fetchedGroups);
            setCollapsedGroupIds(previous => reconcileCollapsedHomeGroupIds(previous, previousGroups, fetchedGroups));
        } catch (err) {
            console.error('Error fetching task groups:', err);
            if (!forceRefresh) {
                setGroups([]);
                groupsRef.current = [];
            }
        }
    }, []);

    useEffect(() => {
        void refreshGroups();
    }, [refreshGroups]);

    useEffect(() => {
        let refreshing = false;
        const syncGroups = async () => {
            if (refreshing || document.visibilityState !== 'visible' || !navigator.onLine) return;
            refreshing = true;
            try {
                await refreshGroups(true);
            } finally {
                refreshing = false;
            }
        };
        // The shared heartbeat already skips hidden or offline windows.
        return subscribeToAppRefresh(() => void syncGroups());
    }, [refreshGroups]);

    return { groups, setGroups, collapsedGroupIds, setCollapsedGroupIds, refreshGroups };
}
