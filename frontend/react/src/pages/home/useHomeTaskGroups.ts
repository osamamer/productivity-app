import { useCallback, useEffect, useRef, useState } from 'react';
import { taskGroupService } from '../../services/api';
import { subscribeToAppRefresh } from '../../services/utils/appRefresh';
import { keepUnchanged } from '../../services/utils/keepUnchanged';
import type { TaskGroup } from '../../types/TaskGroup';
import { collapsedHomeGroupIds, reconcileCollapsedHomeGroupIds } from './homeGroupExpansion';

/**
 * Task groups for Home and which of them are collapsed. Groups start from the service cache,
 * refresh on mount and on the app heartbeat, and new groups arrive collapsed.
 * `groups` stays null until the first answer when nothing was cached; `groupLoadFailed` says
 * that answer failed, so Home can offer a retry instead of spinning.
 */
export function useHomeTaskGroups() {
    const [cachedGroups] = useState(() => taskGroupService.getCachedGroups());
    const [groups, setGroups] = useState<TaskGroup[] | null>(() => cachedGroups ?? null);
    const groupsRef = useRef(groups);
    groupsRef.current = groups;
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
        () => collapsedHomeGroupIds(cachedGroups ?? []),
    );

    const [groupLoadFailed, setGroupLoadFailed] = useState(false);
    // Only the newest request may apply its answer, so a slow older one cannot overwrite it.
    const groupRefreshVersion = useRef(0);

    const refreshGroups = useCallback(async (forceRefresh = false) => {
        const version = ++groupRefreshVersion.current;
        try {
            const fetchedGroups = await taskGroupService.getGroups(forceRefresh);
            if (version !== groupRefreshVersion.current) return;
            const previousGroups = groupsRef.current ?? [];
            const nextGroups = keepUnchanged(previousGroups, fetchedGroups);
            groupsRef.current = nextGroups;
            setGroups(nextGroups);
            setGroupLoadFailed(false);
            setCollapsedGroupIds(previous => reconcileCollapsedHomeGroupIds(previous, previousGroups, fetchedGroups));
        } catch (err) {
            console.error('Error fetching task groups:', err);
            if (version === groupRefreshVersion.current) setGroupLoadFailed(true);
        }
    }, []);

    useEffect(() => {
        const syncGroups = async () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;
            await refreshGroups(true);
        };
        // The app heartbeat also fires once on subscribe, which is the first load.
        return subscribeToAppRefresh(() => void syncGroups());
    }, [refreshGroups]);

    return { groups, setGroups, groupLoadFailed, collapsedGroupIds, setCollapsedGroupIds, refreshGroups };
}
