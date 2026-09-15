import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Button, Typography, Alert, Stack, Skeleton,
    IconButton, Dialog, DialogTitle, DialogContent,
    DialogContentText, DialogActions, TextField, Collapse,
    ListItemIcon, ListItemText, Menu, MenuItem, Snackbar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import AddIcon from '@mui/icons-material/Add';
import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import ViewDayIcon from '@mui/icons-material/ViewDay';
import { PageWrapper } from '../components/PageWrapper';
import { CreateStatForm } from '../components/stats/CreateStatForm';
import { StatRecentDots } from '../components/stats/StatRecentDots';
import { StatCard } from '../components/stats/StatCard';
import { StatCreateLinkedTaskDialog } from '../components/stats/StatCreateLinkedTaskDialog';
import { StatRecurringTaskDialog } from '../components/stats/StatRecurringTaskDialog';
import { StatFocusTaskDialog } from '../components/stats/StatFocusTaskDialog';
import {
    defaultStatRecurringTaskDraft,
    timeOfDayFromDateTime,
} from '../components/stats/statRecurringTaskUtils';
import { StatDefinition, StatRecurringTaskDraft } from '../types/Stats';
import { StatGroup } from '../types/StatGroup';
import { useUser } from '../hooks/useUser';
import { useKeyboardDelete } from '../hooks/useKeyboardDelete';
import { statService } from '../services/api/statService';
import { statGroupService } from '../services/api/statGroupService';
import { subscribeToResourceInvalidation } from '../services/cache/resourceInvalidation';
import {
    readOpenStatGroupIds,
    statGroupPreferencesStorageKey,
    writeOpenStatGroupIds,
} from '../services/utils/statGroupPreferences';

const DEDICATED_SYSTEM_KEYS = new Set([
    'meditated',
    'meditation_minutes',
    'energy',
    'activation',
    'stimulation_hunger',
    'clarity',
    'stimulation',
    'hunger',
    'arousal',
    'valence',
    'emotional_load',
]);

const EDITABLE_SYSTEM_KEYS = new Set(['sleep_hours', 'sleep_time', 'wake_up_time']);

function isEditableSystemStat(definition: StatDefinition): boolean {
    return definition.systemKey !== undefined && EDITABLE_SYSTEM_KEYS.has(definition.systemKey);
}

function canCreateRecurringTask(definition: StatDefinition): boolean {
    return definition.type === 'BOOLEAN' && !definition.recurringTaskSeriesId;
}

const SELECTION_ACTIONS_EDGE_PADDING = 12;
const SELECTION_ACTIONS_GAP = 12;
const SELECTION_ACTIONS_FALLBACK_WIDTH = 88;

type GroupDropPosition = 'before' | 'after';
type PopupPosition = { top: number; left: number };

type ContextMenuState =
    | { kind: 'stat'; definition: StatDefinition; top: number; left: number }
    | { kind: 'group'; group: StatGroup; top: number; left: number };

type PendingStatCreation = {
    tempId: string;
    groupId: string | null;
    groupDefinitionIds: string[];
    selectedIdBeforeCreation: string | null;
};

type PendingDefinitionMutation = {
    definitionId: string;
    version: number;
    previous: StatDefinition;
};

function popupPositionForElement(element: HTMLElement): PopupPosition {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.bottom + 8, left: bounds.left };
}

const selectionActionsReveal = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

function isDedicatedStat(definition: StatDefinition): boolean {
    return definition.systemKey !== undefined && DEDICATED_SYSTEM_KEYS.has(definition.systemKey);
}

function StatsLoadingState() {
    return (
        <Box sx={{
            display: 'flex',
            flex: 1,
            gap: 2,
            overflow: 'hidden',
            minHeight: 0,
            flexDirection: { xs: 'column', md: 'row' },
        }}>
            <Box sx={{
                width: { xs: '100%', md: 360 },
                flexShrink: 0,
                overflow: 'hidden',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: { xs: 180, md: 0 },
                maxHeight: { xs: 270, md: 'none' },
            }}>
                {[0, 1].map(group => (
                    <Box key={group}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            <Skeleton variant="rounded" width={28} height={28} />
                            <Skeleton variant="text" width={`${42 + group * 12}%`} />
                        </Stack>
                        {[0, 1].map(stat => (
                            <Stack key={stat} direction="row" alignItems="center" spacing={1} sx={{ pl: 3, mb: 1.25 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton variant="text" width={`${62 + stat * 13}%`} />
                                    <Skeleton variant="text" width={`${42 + stat * 9}%`} height={17} />
                                </Box>
                                <Skeleton variant="circular" width={24} height={24} />
                            </Stack>
                        ))}
                    </Box>
                ))}
            </Box>
            <Box sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
            }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Skeleton variant="circular" width={34} height={34} />
                    <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="30%" height={25} />
                        <Skeleton variant="text" width="48%" height={18} />
                    </Box>
                    <Skeleton variant="rounded" width={34} height={34} />
                </Stack>
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        {[0, 1, 2].map(item => (
                            <Skeleton key={item} variant="rounded" height={58} sx={{ flex: 1 }} />
                        ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                        <Skeleton variant="rounded" width={190} height={34} />
                        <Skeleton variant="rounded" width={220} height={40} />
                    </Stack>
                    <Skeleton variant="rounded" height={200} />
                </Box>
            </Box>
        </Box>
    );
}

export function StatsPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { user } = useUser();
    const groupPreferencesKey = statGroupPreferencesStorageKey(user?.id);
    const [definitions, setDefinitions] = useState<StatDefinition[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedStatIds, setSelectedStatIds] = useState<string[]>([]);
    const [selectionActionsPosition, setSelectionActionsPosition] = useState<{ top: number; left: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createStatGroupTarget, setCreateStatGroupTarget] = useState<StatGroup | null>(null);
    const [editTarget, setEditTarget] = useState<StatDefinition | null>(null);
    const [entryRefreshKeys, setEntryRefreshKeys] = useState<Record<string, number>>({});
    const [resourceRefreshKey, setResourceRefreshKey] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<StatDefinition | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [groups, setGroups] = useState<StatGroup[]>([]);
    const [groupError, setGroupError] = useState<string | null>(null);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupEditTarget, setGroupEditTarget] = useState<StatGroup | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupSaving, setGroupSaving] = useState(false);
    const [deleteGroupTarget, setDeleteGroupTarget] = useState<StatGroup | null>(null);
    const [groupCreateDefinitionIds, setGroupCreateDefinitionIds] = useState<string[]>([]);
    const [groupOrderError, setGroupOrderError] = useState<string | null>(null);
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
    const [dragTargetGroupPosition, setDragTargetGroupPosition] = useState<GroupDropPosition | null>(null);
    const [bulkDeleteTargets, setBulkDeleteTargets] = useState<StatDefinition[] | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => readOpenStatGroupIds(groupPreferencesKey));
    // Preserve each opened group's row state so collapsing it does not restart dot loading.
    const [mountedGroupIds, setMountedGroupIds] = useState<Set<string>>(() => (
        new Set(readOpenStatGroupIds(groupPreferencesKey))
    ));
    const [loadedGroupPreferencesKey, setLoadedGroupPreferencesKey] = useState(groupPreferencesKey);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [dayContextMenu, setDayContextMenu] = useState<{ date: string; top: number; left: number } | null>(null);
    const [recurringTaskSavingId] = useState<string | null>(null);
    const [recurringTaskError, setRecurringTaskError] = useState<string | null>(null);
    const [recurringTaskTarget, setRecurringTaskTarget] = useState<StatDefinition | null>(null);
    const [recurringTaskAnchorPosition, setRecurringTaskAnchorPosition] = useState<PopupPosition | null>(null);
    const [recurringTaskFeedback, setRecurringTaskFeedback] = useState<string | null>(null);
    const [recurringTaskMode, setRecurringTaskMode] = useState<'create' | 'update'>('create');
    const [recurringTaskInitialDraft, setRecurringTaskInitialDraft] = useState<StatRecurringTaskDraft | null>(null);
    const [createLinkedTaskSavingId] = useState<string | null>(null);
    const [createLinkedTaskError, setCreateLinkedTaskError] = useState<string | null>(null);
    const [createLinkedTaskTarget, setCreateLinkedTaskTarget] = useState<StatDefinition | null>(null);
    const [createLinkedTaskAnchorPosition, setCreateLinkedTaskAnchorPosition] = useState<PopupPosition | null>(null);
    const [focusTaskSavingId] = useState<string | null>(null);
    const [focusTaskError, setFocusTaskError] = useState<string | null>(null);
    const [focusTaskTarget, setFocusTaskTarget] = useState<StatDefinition | null>(null);
    const [focusTaskAnchorPosition, setFocusTaskAnchorPosition] = useState<PopupPosition | null>(null);
    const [focusTaskFeedback, setFocusTaskFeedback] = useState<string | null>(null);
    const [errorSnackbar, setErrorSnackbar] = useState<string | null>(null);
    const selectionAnchorRef = useRef<string | null>(null);
    const selectionActionsRef = useRef<HTMLDivElement | null>(null);
    const pendingStatCreationsRef = useRef(new Map<string, PendingStatCreation>());
    const definitionsRef = useRef<StatDefinition[]>([]);
    const groupsRef = useRef<StatGroup[]>([]);
    const definitionMutationVersionsRef = useRef(new Map<string, number>());
    const pendingDefinitionMutationsRef = useRef(new Map<string, PendingDefinitionMutation>());
    const definitionOrderVersionRef = useRef(0);
    const groupMutationVersionRef = useRef(0);

    useEffect(() => { definitionsRef.current = definitions; }, [definitions]);
    useEffect(() => { groupsRef.current = groups; }, [groups]);

    const showErrorSnackbar = useCallback((message: string) => {
        setErrorSnackbar(message);
    }, []);

    useEffect(() => {
        if (loadedGroupPreferencesKey === groupPreferencesKey) return;
        const nextOpenGroupIds = readOpenStatGroupIds(groupPreferencesKey);
        setOpenGroupIds(nextOpenGroupIds);
        setMountedGroupIds(new Set(nextOpenGroupIds));
        setLoadedGroupPreferencesKey(groupPreferencesKey);
    }, [groupPreferencesKey, loadedGroupPreferencesKey]);

    useEffect(() => {
        if (loadedGroupPreferencesKey !== groupPreferencesKey) return;
        writeOpenStatGroupIds(groupPreferencesKey, openGroupIds);
    }, [groupPreferencesKey, loadedGroupPreferencesKey, openGroupIds]);

    const loadDefinitions = useCallback(() => {
        return statService.getDefinitions()
            .then(defs => {
                const pendingDefinitionIds = new Set([
                    ...Array.from(pendingStatCreationsRef.current.values()).map(pending => pending.tempId),
                    ...Array.from(pendingDefinitionMutationsRef.current.values())
                        .map(pending => pending.definitionId),
                ]);
                const optimisticDefinitions = definitionsRef.current.filter(definition =>
                    pendingDefinitionIds.has(definition.id),
                );
                const serverDefinitionIds = new Set(defs.map(definition => definition.id));
                const mergedDefinitions = [
                    ...defs.map(definition => optimisticDefinitions.find(
                        optimistic => optimistic.id === definition.id,
                    ) ?? definition),
                    ...optimisticDefinitions.filter(definition => !serverDefinitionIds.has(definition.id)),
                ];
                definitionsRef.current = mergedDefinitions;
                setDefinitions(mergedDefinitions);
                setSelectedId(prev => {
                    const visibleDefs = mergedDefinitions.filter(definition =>
                        !isDedicatedStat(definition) && !pendingStatCreationsRef.current.has(definition.id),
                    );
                    if (prev && visibleDefs.some(d => d.id === prev)) return prev;
                    return visibleDefs[0]?.id ?? null;
                });
                setSelectedStatIds(previous => previous.filter(id =>
                    mergedDefinitions.some(definition => !isDedicatedStat(definition) && definition.id === id),
                ));
            })
            .catch(e => {
                console.error('Failed to load stat definitions:', e);
                setError('Failed to load statistics.');
            });
    }, []);

    const loadGroups = useCallback(() => {
        return statGroupService.getGroups()
            .then(setGroups)
            .catch(e => {
                console.error('Failed to load stat groups:', e);
                setGroupError('Could not load statistic groups.');
            });
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        setGroupError(null);
        Promise.all([loadDefinitions(), loadGroups()]).finally(() => {
            if (active) setLoading(false);
        });

        return () => { active = false; };
    }, [loadDefinitions, loadGroups]);

    useEffect(() => subscribeToResourceInvalidation('tasks', () => {
        setResourceRefreshKey(previous => previous + 1);
    }), []);

    useEffect(() => subscribeToResourceInvalidation('stats', () => {
        setResourceRefreshKey(previous => previous + 1);
        void loadDefinitions();
    }), [loadDefinitions]);

    const handleEntryChanged = useCallback((definitionId: string) => {
        setEntryRefreshKeys(previous => ({
            ...previous,
            [definitionId]: (previous[definitionId] ?? 0) + 1,
        }));
    }, []);

    const applyOptimisticDefinition = (
        optimisticDefinition: StatDefinition,
        operationId: string,
        previous: StatDefinition,
    ) => {
        const version = (definitionMutationVersionsRef.current.get(optimisticDefinition.id) ?? 0) + 1;
        definitionMutationVersionsRef.current.set(optimisticDefinition.id, version);
        pendingDefinitionMutationsRef.current.set(operationId, {
            definitionId: optimisticDefinition.id,
            version,
            previous,
        });
        definitionsRef.current = definitionsRef.current.map(definition =>
            definition.id === optimisticDefinition.id ? optimisticDefinition : definition,
        );
        setDefinitions(definitionsRef.current);
        setFocusTaskTarget(current => current?.id === optimisticDefinition.id ? optimisticDefinition : current);
        setRecurringTaskTarget(current => current?.id === optimisticDefinition.id ? optimisticDefinition : current);
    };

    const reconcileDefinition = (updated: StatDefinition, operationId?: string) => {
        if (operationId) {
            const pending = pendingDefinitionMutationsRef.current.get(operationId);
            if (!pending) return;
            pendingDefinitionMutationsRef.current.delete(operationId);
            if (definitionMutationVersionsRef.current.get(pending.definitionId) !== pending.version) return;
        }
        definitionsRef.current = definitionsRef.current.map(definition =>
            definition.id === updated.id ? updated : definition,
        );
        setDefinitions(definitionsRef.current);
        setFocusTaskTarget(current => current?.id === updated.id ? updated : current);
        setRecurringTaskTarget(current => current?.id === updated.id ? updated : current);
        setEditTarget(current => current?.id === updated.id ? null : current);
    };

    const rollbackDefinition = (
        operationId: string,
        fallbackPrevious: StatDefinition,
        message = 'Could not save that statistic change.',
    ) => {
        const pending = pendingDefinitionMutationsRef.current.get(operationId);
        if (!pending) {
            showErrorSnackbar(message);
            return;
        }
        pendingDefinitionMutationsRef.current.delete(operationId);
        if (definitionMutationVersionsRef.current.get(pending.definitionId) !== pending.version) {
            showErrorSnackbar(message);
            return;
        }
        const previous = pending.previous ?? fallbackPrevious;
        definitionsRef.current = definitionsRef.current.map(definition =>
            definition.id === previous.id ? previous : definition,
        );
        setDefinitions(definitionsRef.current);
        setFocusTaskTarget(current => current?.id === previous.id ? previous : current);
        setRecurringTaskTarget(current => current?.id === previous.id ? previous : current);
        showErrorSnackbar(message);
    };

    const handleCreatedOptimistically = (draft: StatDefinition, operationId: string) => {
        const groupTarget = createStatGroupTarget;
        pendingStatCreationsRef.current.set(operationId, {
            tempId: draft.id,
            groupId: groupTarget?.groupId ?? null,
            groupDefinitionIds: groupTarget?.statDefinitionIds ?? [],
            selectedIdBeforeCreation: selectedId,
        });
        definitionsRef.current = [...definitionsRef.current, draft];
        setDefinitions(definitionsRef.current);
        if (groupTarget) {
            groupsRef.current = groupsRef.current.map(group => group.groupId === groupTarget.groupId
                ? { ...group, statDefinitionIds: [...new Set([...group.statDefinitionIds, draft.id])] }
                : group);
            setGroups(groupsRef.current);
        }
        closeCreateStatDialog();
    };

    const handleCreationFailed = (operationId: string) => {
        const pending = pendingStatCreationsRef.current.get(operationId);
        if (!pending) return;
        pendingStatCreationsRef.current.delete(operationId);
        definitionsRef.current = definitionsRef.current.filter(definition => definition.id !== pending.tempId);
        setDefinitions(definitionsRef.current);
        groupsRef.current = groupsRef.current.map(group => ({
            ...group,
            statDefinitionIds: group.statDefinitionIds.filter(id => id !== pending.tempId),
        }));
        setGroups(groupsRef.current);
        setSelectedId(current => current === pending.tempId ? null : current);
        setSelectedStatIds(previous => previous.filter(id => id !== pending.tempId));
        if (selectionAnchorRef.current === pending.tempId) selectionAnchorRef.current = null;
        showErrorSnackbar('Could not create that statistic.');
    };

    const handleCreated = (def: StatDefinition, operationId?: string) => {
        if (operationId) {
            const pending = pendingStatCreationsRef.current.get(operationId);
            if (!pending) return;
            pendingStatCreationsRef.current.delete(operationId);
            definitionsRef.current = definitionsRef.current.map(definition =>
                definition.id === pending.tempId ? def : definition,
            );
            setDefinitions(definitionsRef.current);
            setSelectedId(current => current === null && pending.selectedIdBeforeCreation === null
                ? def.id
                : current);
            if (def.recurringTaskSeriesId) setRecurringTaskFeedback('Recurring task created.');

            if (pending.groupId) {
                const nextDefinitionIds = groupsRef.current
                    .find(group => group.groupId === pending.groupId)
                    ?.statDefinitionIds
                    .map(id => id === pending.tempId ? def.id : id)
                    ?? [...new Set([...pending.groupDefinitionIds, def.id])];
                setGroups(previous => previous.map(group => group.groupId === pending.groupId
                    ? { ...group, statDefinitionIds: nextDefinitionIds }
                    : group));
                const groupMutationVersion = ++groupMutationVersionRef.current;
                void statGroupService.replaceDefinitions(pending.groupId, nextDefinitionIds)
                    .then(updatedGroup => {
                        if (groupMutationVersion !== groupMutationVersionRef.current) return;
                        setGroups(previous => previous.map(group => group.groupId === updatedGroup.groupId
                            ? updatedGroup
                            : group));
                    })
                    .catch(e => {
                        console.error('Failed to add new stat to group:', e);
                        if (groupMutationVersion === groupMutationVersionRef.current) {
                            setGroups(previous => previous.map(group => group.groupId === pending.groupId
                                ? { ...group, statDefinitionIds: group.statDefinitionIds.filter(id => id !== def.id) }
                                : group));
                        }
                        setGroupError('The statistic was created, but could not be added to the group.');
                        showErrorSnackbar('The statistic was created, but could not be added to the group.');
                    });
            }
            return;
        }

        const groupTarget = createStatGroupTarget;
        setDefinitions(prev => [...prev, def]);
        setSelectedId(def.id);
        setSelectedStatIds([def.id]);
        selectionAnchorRef.current = def.id;
        setShowCreateForm(false);
        setCreateStatGroupTarget(null);
        if (def.recurringTaskSeriesId) setRecurringTaskFeedback('Recurring task created.');

        if (groupTarget) {
            const nextDefinitionIds = [...new Set([...groupTarget.statDefinitionIds, def.id])];
            setGroups(previous => previous.map(group => group.groupId === groupTarget.groupId
                ? { ...group, statDefinitionIds: nextDefinitionIds }
                : group));
            const groupMutationVersion = ++groupMutationVersionRef.current;
            void statGroupService.replaceDefinitions(groupTarget.groupId, nextDefinitionIds)
                .then(updatedGroup => {
                    if (groupMutationVersion !== groupMutationVersionRef.current) return;
                    setGroups(previous => previous.map(group => group.groupId === updatedGroup.groupId
                        ? updatedGroup
                        : group));
                })
                .catch(e => {
                    console.error('Failed to add new stat to group:', e);
                    if (groupMutationVersion === groupMutationVersionRef.current) {
                        setGroups(previous => previous.map(group => group.groupId === groupTarget.groupId
                            ? { ...group, statDefinitionIds: group.statDefinitionIds.filter(id => id !== def.id) }
                            : group));
                    }
                    setGroupError('The statistic was created, but could not be added to the group.');
                    showErrorSnackbar('The statistic was created, but could not be added to the group.');
                });
        }
    };

    const openCreateStatDialog = (group: StatGroup | null = null) => {
        setCreateStatGroupTarget(group);
        setShowCreateForm(true);
    };

    const closeCreateStatDialog = () => {
        setShowCreateForm(false);
        setCreateStatGroupTarget(null);
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleUpdated = (updated: StatDefinition, operationId?: string) => {
        reconcileDefinition(updated, operationId);
    };

    const handleUpdatedOptimistically = (
        updated: StatDefinition,
        operationId: string,
        previous: StatDefinition,
    ) => {
        applyOptimisticDefinition(updated, operationId, previous);
        setEditTarget(null);
    };

    const handleUpdateFailed = (operationId: string, previous: StatDefinition) => {
        rollbackDefinition(operationId, previous);
        setEditTarget(null);
    };

    const handleAddFocusTask = (definition: StatDefinition, taskName: string) => {
        const trimmedTaskName = taskName.trim();
        if (!trimmedTaskName) return;
        const previous = definitionsRef.current.find(item => item.id === definition.id) ?? definition;
        const linkedTaskNames = [...new Set([
            ...(previous.focusTaskNames ?? (previous.focusTaskName ? [previous.focusTaskName] : [])),
            trimmedTaskName,
        ])];
        const optimisticDefinition = {
            ...previous,
            focusTaskName: linkedTaskNames[0] ?? null,
            focusTaskNames: linkedTaskNames,
        };
        const operationId = `stat-focus-link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        applyOptimisticDefinition(optimisticDefinition, operationId, previous);
        setFocusTaskTarget(optimisticDefinition);
        setFocusTaskError(null);
        void statService.linkFocusTask(definition.id, trimmedTaskName)
            .then(updated => {
                handleUpdated(updated, operationId);
                setFocusTaskFeedback(`Focus time linked to “${trimmedTaskName}”.`);
            })
            .catch(error => {
                console.error('Failed to link task focus time:', error);
                rollbackDefinition(operationId, previous, 'Could not link those tasks.');
                setFocusTaskError('Could not link those tasks. Please try again.');
            });
    };

    const handleCreateLinkedTask = (definition: StatDefinition, taskName: string, importance: number) => {
        const trimmedTaskName = taskName.trim();
        if (!trimmedTaskName) return;
        const previous = definitionsRef.current.find(item => item.id === definition.id) ?? definition;
        const linkedTaskNames = [...new Set([
            ...(previous.focusTaskNames ?? (previous.focusTaskName ? [previous.focusTaskName] : [])),
            trimmedTaskName,
        ])];
        const optimisticDefinition = {
            ...previous,
            focusTaskName: linkedTaskNames[0] ?? null,
            focusTaskNames: linkedTaskNames,
        };
        const operationId = `stat-focus-start-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        applyOptimisticDefinition(optimisticDefinition, operationId, previous);
        setCreateLinkedTaskError(null);
        setCreateLinkedTaskTarget(null);
        setCreateLinkedTaskAnchorPosition(null);
        void statService.startFocusTask(definition.id, trimmedTaskName, importance)
            .then(task => {
                reconcileDefinition({ ...optimisticDefinition }, operationId);
                navigate('/', { state: { openPomodoroTaskId: task.taskId } });
            })
            .catch(error => {
                console.error('Failed to create linked task:', error);
                rollbackDefinition(operationId, previous, 'Could not create the linked task.');
                setCreateLinkedTaskError('Could not create the linked task. Please try again.');
            });
    };

    const handleCreateRecurringLinkedTask = (definition: StatDefinition,
                                              taskName: string,
                                              recurrence: StatRecurringTaskDraft) => {
        const trimmedTaskName = taskName.trim();
        const previous = definitionsRef.current.find(item => item.id === definition.id) ?? definition;
        const linkedTaskNames = [...new Set([
            ...(previous.focusTaskNames ?? (previous.focusTaskName ? [previous.focusTaskName] : [])),
            trimmedTaskName,
        ])];
        const optimisticDefinition = {
            ...previous,
            recurringTaskSeriesId: `optimistic-series-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            focusTaskName: linkedTaskNames[0] ?? null,
            focusTaskNames: linkedTaskNames,
        };
        const operationId = `stat-recurring-start-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        applyOptimisticDefinition(optimisticDefinition, operationId, previous);
        setCreateLinkedTaskError(null);
        setCreateLinkedTaskTarget(null);
        setCreateLinkedTaskAnchorPosition(null);
        void statService.createRecurringTask(definition.id, { ...recurrence, taskName: trimmedTaskName })
            .then(updated => {
                handleUpdated(updated, operationId);
                setCreateLinkedTaskError(null);
                setRecurringTaskFeedback(`Recurring task “${trimmedTaskName}” created.`);
            })
            .catch(error => {
                console.error('Failed to create recurring linked task:', error);
                rollbackDefinition(operationId, previous, 'Could not create the recurring linked task.');
                setCreateLinkedTaskError('Could not create the recurring linked task. Please try again.');
            });
    };

    const handleRemoveFocusTask = (definition: StatDefinition, taskName: string) => {
        const previous = definitionsRef.current.find(item => item.id === definition.id) ?? definition;
        const linkedTaskNames = (previous.focusTaskNames ?? (previous.focusTaskName ? [previous.focusTaskName] : []))
            .filter(name => name.toLocaleLowerCase() !== taskName.toLocaleLowerCase());
        const optimisticDefinition = {
            ...previous,
            focusTaskName: linkedTaskNames[0] ?? null,
            focusTaskNames: linkedTaskNames,
        };
        const operationId = `stat-focus-unlink-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        applyOptimisticDefinition(optimisticDefinition, operationId, previous);
        setFocusTaskTarget(optimisticDefinition);
        setFocusTaskError(null);
        void statService.unlinkFocusTask(definition.id, taskName)
            .then(updated => {
                handleUpdated(updated, operationId);
                setFocusTaskFeedback(`Focus time unlinked from “${taskName}”.`);
            })
            .catch(error => {
                console.error('Failed to unlink task focus time:', error);
                rollbackDefinition(operationId, previous, 'Could not remove that linked task.');
                setFocusTaskError('Could not remove that linked task. Please try again.');
            });
    };

    const handleSaveRecurringTask = (definition: StatDefinition, recurrence: StatRecurringTaskDraft) => {
        const mode = recurringTaskMode;
        if ((mode === 'create' && !canCreateRecurringTask(definition))
            || (mode === 'update' && !definition.recurringTaskSeriesId)) return;

        const previous = definitionsRef.current.find(item => item.id === definition.id) ?? definition;
        setRecurringTaskError(null);
        const operationId = `stat-recurring-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (mode === 'create') {
            const linkedTaskNames = [...new Set([
                ...(previous.focusTaskNames ?? (previous.focusTaskName ? [previous.focusTaskName] : [])),
                previous.name,
            ])];
            const optimisticDefinition = {
                ...previous,
                recurringTaskSeriesId: `optimistic-series-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                focusTaskName: linkedTaskNames[0] ?? null,
                focusTaskNames: linkedTaskNames,
            };
            applyOptimisticDefinition(optimisticDefinition, operationId, previous);
            setRecurringTaskTarget(null);
            setRecurringTaskAnchorPosition(null);
            setRecurringTaskInitialDraft(null);
            setEditTarget(null);

            void statService.createRecurringTask(definition.id, recurrence)
                .then(updated => {
                    handleUpdated(updated, operationId);
                    setRecurringTaskFeedback('Recurring task created.');
                })
                .catch(error => {
                    console.error('Failed to create recurring task for stat:', error);
                    rollbackDefinition(operationId, previous, 'Could not create the recurring task.');
                    setRecurringTaskError('Could not create the recurring task. Please try again.');
                });
            return;
        }

        applyOptimisticDefinition(previous, operationId, previous);
        setRecurringTaskTarget(null);
        setRecurringTaskAnchorPosition(null);
        setRecurringTaskInitialDraft(null);
        void statService.updateRecurringTask(definition.id, recurrence)
            .then(updated => {
                handleUpdated(updated, operationId);
                setRecurringTaskFeedback('Recurring task schedule updated.');
            })
            .catch(error => {
                console.error('Failed to update recurring task schedule for stat:', error);
                rollbackDefinition(operationId, previous, 'Could not update the recurring task schedule.');
                setRecurringTaskError('Could not update the recurring task schedule. Please try again.');
            });
    };

    const openRecurringTaskEditor = (definition: StatDefinition, anchorPosition?: PopupPosition) => {
        setRecurringTaskError(null);
        setRecurringTaskAnchorPosition(anchorPosition ?? null);
        void statService.getRecurringTask(definition.id)
            .then(series => {
                const recurrenceDaysOfWeek = series.recurrenceDaysOfWeek?.length
                    ? series.recurrenceDaysOfWeek
                    : defaultStatRecurringTaskDraft().recurrenceDaysOfWeek;
                setRecurringTaskInitialDraft({
                    recurrenceFrequency: series.recurrenceFrequency,
                    recurrenceDaysOfWeek,
                    timeOfDay: timeOfDayFromDateTime(series.startDateTime),
                    importance: series.importance,
                });
                setRecurringTaskMode('update');
                setRecurringTaskTarget(definition);
            })
            .catch(error => {
                console.error('Failed to load recurring task schedule:', error);
                setRecurringTaskError('Could not load the recurring task schedule. Please try again.');
                showErrorSnackbar('Could not load the recurring task schedule.');
            });
    };

    const handleDeleteConfirm = () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        const previousDefinitions = definitionsRef.current;
        const previousGroups = groupsRef.current;
        const previousSelectedId = selectedId;
        const previousSelectedStatIds = selectedStatIds;
        const previousAnchor = selectionAnchorRef.current;
        const groupMutationVersion = ++groupMutationVersionRef.current;
        const targetIndex = previousDefinitions.findIndex(definition => definition.id === target.id);
        const mutationVersion = (definitionMutationVersionsRef.current.get(target.id) ?? 0) + 1;
        definitionMutationVersionsRef.current.set(target.id, mutationVersion);
        const nextDefinitions = previousDefinitions.filter(definition => definition.id !== target.id);
        setDefinitions(nextDefinitions);
        setGroups(previousGroups.map(group => ({
            ...group,
            statDefinitionIds: group.statDefinitionIds.filter(id => id !== target.id),
        })));
        setSelectedStatIds(previous => previous.filter(id => id !== target.id));
        if (selectedId === target.id) {
            setSelectedId(nextDefinitions.find(definition =>
                !isDedicatedStat(definition) && !pendingStatCreationsRef.current.has(definition.id),
            )?.id ?? null);
        }
        if (selectionAnchorRef.current === target.id) selectionAnchorRef.current = null;
        setEditTarget(null);
        setDeleteTarget(null);

        void statService.deleteDefinition(target.id)
            .catch(error => {
                console.error('Failed to delete stat definition:', error);
                if (definitionMutationVersionsRef.current.get(target.id) === mutationVersion) {
                    const currentDefinitions = definitionsRef.current;
                    if (!currentDefinitions.some(definition => definition.id === target.id)) {
                        const insertionIndex = Math.max(0, Math.min(targetIndex, currentDefinitions.length));
                        setDefinitions([
                            ...currentDefinitions.slice(0, insertionIndex),
                            target,
                            ...currentDefinitions.slice(insertionIndex),
                        ]);
                    }
                    if (groupMutationVersionRef.current === groupMutationVersion) {
                        setGroups(previousGroups);
                    }
                    setSelectedId(previousSelectedId);
                    setSelectedStatIds(previousSelectedStatIds);
                    selectionAnchorRef.current = previousAnchor;
                }
                showErrorSnackbar('Could not delete that statistic.');
            });
    };

    const clearSelection = () => {
        setSelectedStatIds([]);
        selectionAnchorRef.current = null;
    };

    const openCreateGroupDialog = (definitionIds: string[] = []) => {
        setGroupEditTarget(null);
        setGroupCreateDefinitionIds(definitionIds);
        setGroupName('');
        setGroupError(null);
        setGroupDialogOpen(true);
    };

    const openRenameGroupDialog = (group: StatGroup) => {
        setGroupEditTarget(group);
        setGroupCreateDefinitionIds([]);
        setGroupName(group.name);
        setGroupError(null);
        setGroupDialogOpen(true);
    };

    const closeGroupDialog = () => {
        setGroupDialogOpen(false);
        setGroupEditTarget(null);
        setGroupCreateDefinitionIds([]);
        setGroupName('');
    };

    const saveGroup = () => {
        const trimmedName = groupName.trim();
        if (!trimmedName || groupSaving) return;

        const previousGroups = groupsRef.current;
        const mutationVersion = ++groupMutationVersionRef.current;
        setGroupSaving(true);
        setGroupError(null);
        if (groupEditTarget) {
            const target = groupEditTarget;
            const optimisticGroup = { ...target, name: trimmedName };
            setGroups(previousGroups.map(group => group.groupId === target.groupId
                ? optimisticGroup
                : group));
            closeGroupDialog();
            void statGroupService.renameGroup(target.groupId, trimmedName)
                .then(updatedGroup => {
                    if (mutationVersion !== groupMutationVersionRef.current) return;
                    setGroups(current => current.map(group =>
                        group.groupId === updatedGroup.groupId ? updatedGroup : group,
                    ));
                })
                .catch(error => {
                    console.error('Failed to rename stat group:', error);
                    if (mutationVersion === groupMutationVersionRef.current) setGroups(previousGroups);
                    setGroupError('Could not save this statistic group.');
                    showErrorSnackbar('Could not rename this statistic group.');
                })
                .finally(() => setGroupSaving(false));
            return;
        }

        const temporaryGroupId = `optimistic-group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const selectedDefinitionIdSet = new Set(groupCreateDefinitionIds);
        const previousSelectedIds = selectedStatIds;
        const previousSelectedId = selectedId;
        const previousAnchor = selectionAnchorRef.current;
        const optimisticGroup: StatGroup = {
            groupId: temporaryGroupId,
            name: trimmedName,
            statDefinitionIds: [...groupCreateDefinitionIds],
            displayOrder: previousGroups.length,
        };
        setGroups([
            ...previousGroups.map(group => ({
                ...group,
                statDefinitionIds: group.statDefinitionIds.filter(id => !selectedDefinitionIdSet.has(id)),
            })),
            optimisticGroup,
        ]);
        if (groupCreateDefinitionIds.length > 1) clearSelection();
        closeGroupDialog();
        void statGroupService.createGroup(trimmedName, groupCreateDefinitionIds)
            .then(createdGroup => {
                setGroups(current => current.map(group => group.groupId === temporaryGroupId
                    ? { ...createdGroup, statDefinitionIds: group.statDefinitionIds }
                    : group));
            })
            .catch(error => {
                console.error('Failed to create stat group:', error);
                if (mutationVersion === groupMutationVersionRef.current) {
                    setGroups(previousGroups);
                    if (groupCreateDefinitionIds.length > 1) {
                        setSelectedStatIds(previousSelectedIds);
                        setSelectedId(previousSelectedId);
                        selectionAnchorRef.current = previousAnchor;
                    }
                } else {
                    setGroups(current => current.filter(group => group.groupId !== temporaryGroupId));
                }
                setGroupError('Could not save this statistic group.');
                showErrorSnackbar('Could not create this statistic group.');
            })
            .finally(() => setGroupSaving(false));
    };

    const deleteGroup = () => {
        if (!deleteGroupTarget) return;

        const groupToDelete = deleteGroupTarget;
        const previousGroups = groupsRef.current;
        const previousOpenGroupIds = new Set(openGroupIds);
        const mutationVersion = ++groupMutationVersionRef.current;
        setGroupError(null);
        setGroups(previousGroups.filter(group => group.groupId !== groupToDelete.groupId));
        setOpenGroupIds(previous => {
            const next = new Set(previous);
            next.delete(groupToDelete.groupId);
            return next;
        });
        setDeleteGroupTarget(null);
        void statGroupService.deleteGroup(groupToDelete.groupId)
            .catch(error => {
                console.error('Failed to delete stat group:', error);
                if (mutationVersion === groupMutationVersionRef.current) {
                    setGroups(previousGroups);
                    setOpenGroupIds(previousOpenGroupIds);
                }
                setGroupError('Could not delete this statistic group.');
                showErrorSnackbar('Could not delete this statistic group.');
            });
    };

    const toggleGroup = (groupId: string) => {
        setOpenGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
        setMountedGroupIds(prev => {
            if (prev.has(groupId)) return prev;
            const next = new Set(prev);
            next.add(groupId);
            return next;
        });
    };

    const visibleDefinitions = useMemo(
        () => definitions.filter(definition => !isDedicatedStat(definition)),
        [definitions],
    );
    const selectableDefinitions = useMemo(
        () => visibleDefinitions.filter(definition => !pendingStatCreationsRef.current.has(definition.id)),
        [visibleDefinitions],
    );
    const selectedDef = selectableDefinitions.find(d => d.id === selectedId) ?? null;
    const selectedStatIdSet = useMemo(() => new Set(selectedStatIds), [selectedStatIds]);
    const selectedDefinitions = useMemo(
        () => selectableDefinitions.filter(definition => selectedStatIdSet.has(definition.id)),
        [selectableDefinitions, selectedStatIdSet],
    );
    const selectedDeletableDefinitions = useMemo(
        () => selectedDefinitions.filter(definition => !definition.systemKey),
        [selectedDefinitions],
    );
    const keyboardSelectedDefinitions = selectedStatIds.length > 0
        ? selectedDefinitions
        : selectedDef
            ? [selectedDef]
            : [];

    useKeyboardDelete({
        enabled: keyboardSelectedDefinitions.length > 0
            && !loading
            && !showCreateForm
            && !editTarget
            && !groupDialogOpen
            && !deleteTarget
            && !deleteGroupTarget
            && !bulkDeleteTargets
            && !contextMenu
            && !focusTaskTarget
            && focusTaskSavingId === null
            && !deleteSubmitting,
        onDelete: () => {
            if (keyboardSelectedDefinitions.length > 1) {
                if (selectedDeletableDefinitions.length === keyboardSelectedDefinitions.length) {
                    setBulkDeleteTargets(selectedDeletableDefinitions);
                }
                return;
            }

            const definition = keyboardSelectedDefinitions[0];
            if (definition && !definition.systemKey) setDeleteTarget(definition);
        },
    });

    const groupedDefinitions = useMemo(() => groups.map(group => ({
        group,
        definitions: visibleDefinitions.filter(definition => group.statDefinitionIds.includes(definition.id)),
    })), [groups, visibleDefinitions]);
    const ungroupedDefinitions = useMemo(() => visibleDefinitions.filter(definition =>
        !groups.some(group => group.statDefinitionIds.includes(definition.id)),
    ), [groups, visibleDefinitions]);

    const updateSelectionActionsPosition = useCallback(() => {
        if (selectedStatIds.length < 2) {
            setSelectionActionsPosition(null);
            return;
        }

        const selectedRows = Array.from(document.querySelectorAll<HTMLElement>('[data-stat-id]'))
            .filter(row => selectedStatIdSet.has(row.dataset.statId ?? ''));
        if (selectedRows.length === 0) {
            setSelectionActionsPosition(null);
            return;
        }

        const bounds = selectedRows.map(row => row.getBoundingClientRect());
        const top = Math.min(...bounds.map(rect => rect.top));
        const bottom = Math.max(...bounds.map(rect => rect.bottom));
        const right = Math.max(...bounds.map(rect => rect.right));
        const popupWidth = selectionActionsRef.current?.getBoundingClientRect().width
            ?? SELECTION_ACTIONS_FALLBACK_WIDTH;
        const maxLeft = window.innerWidth - popupWidth - SELECTION_ACTIONS_EDGE_PADDING;
        const left = Math.min(
            Math.max(right + SELECTION_ACTIONS_GAP, SELECTION_ACTIONS_EDGE_PADDING),
            Math.max(SELECTION_ACTIONS_EDGE_PADDING, maxLeft),
        );
        const nextPosition = {
            top: Math.round((top + bottom) / 2),
            left: Math.round(left),
        };

        setSelectionActionsPosition(previous => (
            previous?.top === nextPosition.top && previous.left === nextPosition.left
                ? previous
                : nextPosition
        ));
    }, [selectedStatIdSet, selectedStatIds.length]);

    useLayoutEffect(() => {
        if (selectedStatIds.length < 2) {
            setSelectionActionsPosition(previous => previous === null ? previous : null);
            return undefined;
        }

        updateSelectionActionsPosition();
        const handleViewportChange = () => updateSelectionActionsPosition();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(handleViewportChange);
        if (resizeObserver) {
            document.querySelectorAll<HTMLElement>('[data-stat-id]').forEach(row => {
                if (selectedStatIdSet.has(row.dataset.statId ?? '')) resizeObserver.observe(row);
            });
        }

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
            resizeObserver?.disconnect();
        };
    }, [openGroupIds, definitions, groups, selectedStatIdSet, selectedStatIds.length,
        updateSelectionActionsPosition]);

    const handleDefinitionSelection = (definition: StatDefinition, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const definitionId = definition.id;
        if (pendingStatCreationsRef.current.has(definitionId)) return;
        const anchorId = selectionAnchorRef.current;

        if (event.shiftKey && anchorId) {
            const anchorIndex = visibleDefinitions.findIndex(candidate => candidate.id === anchorId);
            const definitionIndex = visibleDefinitions.findIndex(candidate => candidate.id === definitionId);
            if (anchorIndex !== -1 && definitionIndex !== -1) {
                const rangeStart = Math.min(anchorIndex, definitionIndex);
                const rangeEnd = Math.max(anchorIndex, definitionIndex);
                const rangeIds = visibleDefinitions
                    .slice(rangeStart, rangeEnd + 1)
                    .map(candidate => candidate.id);
                setSelectedStatIds(previous => [...new Set([...previous, ...rangeIds])]);
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedStatIds(previous => {
                const currentSelection = previous.length > 0
                    ? previous
                    : selectedId
                        ? [selectedId]
                        : [];
                const nextSelection = currentSelection.includes(definitionId)
                    ? currentSelection.filter(id => id !== definitionId)
                    : [...currentSelection, definitionId];
                if (selectedId === definitionId && !nextSelection.includes(definitionId)) {
                    setSelectedId(nextSelection[0] ?? null);
                }
                return nextSelection;
            });
            selectionAnchorRef.current = definitionId;
            return;
        }

        setSelectedId(definitionId);
        setSelectedStatIds([definitionId]);
        selectionAnchorRef.current = definitionId;
    };

    const handleBulkDeleteConfirm = () => {
        if (!bulkDeleteTargets || deleteSubmitting) return;

        const targets = bulkDeleteTargets;
        const targetIds = new Set(targets.map(definition => definition.id));
        const previousDefinitions = definitionsRef.current;
        const previousGroups = groupsRef.current;
        const previousSelectedIds = selectedStatIds;
        const previousSelectedId = selectedId;
        const previousAnchor = selectionAnchorRef.current;
        const groupMutationVersion = ++groupMutationVersionRef.current;
        setDeleteSubmitting(true);
        setSelectionError(null);
        const mutationVersions = new Map(targets.map(definition => {
            const version = (definitionMutationVersionsRef.current.get(definition.id) ?? 0) + 1;
            definitionMutationVersionsRef.current.set(definition.id, version);
            return [definition.id, version] as const;
        }));
        setDefinitions(previousDefinitions.filter(definition => !targetIds.has(definition.id)));
        setGroups(previousGroups.map(group => ({
            ...group,
            statDefinitionIds: group.statDefinitionIds.filter(id => !targetIds.has(id)),
        })));
        const nextVisibleDefinitions = previousDefinitions
            .filter(definition => !targetIds.has(definition.id)
                && !isDedicatedStat(definition)
                && !pendingStatCreationsRef.current.has(definition.id));
        if (targetIds.has(selectedId ?? '')) setSelectedId(nextVisibleDefinitions[0]?.id ?? null);
        clearSelection();
        setBulkDeleteTargets(null);

        void Promise.allSettled(targets.map(definition => statService.deleteDefinition(definition.id)))
            .then(results => {
                const failedTargets = targets.filter((_, index) => results[index].status === 'rejected');
                failedTargets.forEach(definition => {
                    const result = results[targets.indexOf(definition)];
                    if (result.status === 'rejected') {
                        console.error('Failed to delete selected stat definition:', result.reason);
                    }
                });
                if (failedTargets.length === 0) return;

                const failedIds = new Set(failedTargets.map(definition => definition.id));
                const successfulIds = new Set(
                    targets
                        .filter(definition => !failedIds.has(definition.id))
                        .map(definition => definition.id),
                );
                setDefinitions(current => {
                    const next = [...current];
                    failedTargets
                        .sort((left, right) => previousDefinitions.indexOf(left) - previousDefinitions.indexOf(right))
                        .forEach(definition => {
                            if (definitionMutationVersionsRef.current.get(definition.id) !== mutationVersions.get(definition.id)
                                || next.some(currentDefinition => currentDefinition.id === definition.id)) return;
                            const insertionIndex = Math.max(0, Math.min(previousDefinitions.indexOf(definition), next.length));
                            next.splice(insertionIndex, 0, definition);
                        });
                    return next;
                });
                if (groupMutationVersionRef.current === groupMutationVersion) {
                    setGroups(previousGroups.map(group => ({
                        ...group,
                        statDefinitionIds: group.statDefinitionIds.filter(id => !successfulIds.has(id)),
                    })));
                }
                setSelectedStatIds(previousSelectedIds.filter(id => failedIds.has(id)));
                setSelectedId(failedIds.has(previousSelectedId ?? '') ? previousSelectedId : nextVisibleDefinitions[0]?.id ?? null);
                if (failedIds.has(previousAnchor ?? '')) selectionAnchorRef.current = previousAnchor;
                setSelectionError('Could not delete the selected statistics.');
                showErrorSnackbar('Could not delete the selected statistics.');
            })
            .finally(() => setDeleteSubmitting(false));
    };

    const finishDefinitionDragging = () => {
        setDraggedId(null);
        setDragTargetGroupId(null);
        setDragTargetGroupPosition(null);
    };

    const handleDefinitionDropIntoGroup = async (targetGroupId: string) => {
        if (!draggedId) return;

        const definitionId = draggedId;
        const previous = groupsRef.current;
        const targetGroup = previous.find(group => group.groupId === targetGroupId);
        if (!targetGroup || targetGroup.statDefinitionIds.includes(definitionId)) {
            finishDefinitionDragging();
            return;
        }

        const next = previous.map(group => ({
            ...group,
            statDefinitionIds: group.groupId === targetGroupId
                ? [...group.statDefinitionIds, definitionId]
                : group.statDefinitionIds.filter(id => id !== definitionId),
        }));
        setGroups(next);
        finishDefinitionDragging();
        setGroupError(null);
        const mutationVersion = ++groupMutationVersionRef.current;

        try {
            const persistedTargetGroup = await statGroupService.replaceDefinitions(
                targetGroupId,
                next.find(group => group.groupId === targetGroupId)!.statDefinitionIds,
            );
            if (mutationVersion === groupMutationVersionRef.current) {
                setGroups(current => current.map(group =>
                    group.groupId === persistedTargetGroup.groupId ? persistedTargetGroup : group,
                ));
            }
        } catch (e) {
            console.error('Failed to move stat into group:', e);
            if (mutationVersion === groupMutationVersionRef.current) setGroups(previous);
            setGroupError('Could not move this statistic into the group.');
            showErrorSnackbar('Could not move this statistic into the group.');
        }
    };

    const handleGroupDrop = async (targetGroupId: string, dropPosition?: GroupDropPosition) => {
        if (!draggedGroupId || draggedGroupId === targetGroupId) return;

        const previous = groupsRef.current;
        const draggedIndex = previous.findIndex(group => group.groupId === draggedGroupId);
        const targetIndex = previous.findIndex(group => group.groupId === targetGroupId);
        const position = dropPosition ?? dragTargetGroupPosition;
        if (draggedIndex < 0 || targetIndex < 0 || !position) return;

        const next = [...previous];
        const [draggedGroup] = next.splice(draggedIndex, 1);
        const adjustedTargetIndex = next.findIndex(group => group.groupId === targetGroupId);
        const insertionIndex = position === 'before'
            ? adjustedTargetIndex
            : adjustedTargetIndex + 1;
        next.splice(insertionIndex, 0, draggedGroup);
        setGroups(next);
        setDraggedGroupId(null);
        setDragTargetGroupId(null);
        setDragTargetGroupPosition(null);
        setGroupOrderError(null);
        const mutationVersion = ++groupMutationVersionRef.current;

        try {
            const persisted = await statGroupService.reorderGroups(next.map(group => group.groupId));
            if (mutationVersion === groupMutationVersionRef.current) setGroups(persisted);
        } catch (e) {
            console.error('Failed to reorder stat groups:', e);
            if (mutationVersion === groupMutationVersionRef.current) setGroups(previous);
            setGroupOrderError('Failed to save the statistic group order.');
            showErrorSnackbar('Failed to save the statistic group order.');
        }
    };

    const finishGroupDragging = () => {
        setDraggedGroupId(null);
        setDragTargetGroupId(null);
        setDragTargetGroupPosition(null);
    };

    const handleDefinitionDrop = async (targetId: string) => {
        if (!draggedId || draggedId === targetId) return;

        const previous = definitionsRef.current;
        const visiblePrevious = previous.filter(definition => !isDedicatedStat(definition));
        const draggedIndex = visiblePrevious.findIndex(def => def.id === draggedId);
        const targetIndex = visiblePrevious.findIndex(def => def.id === targetId);
        if (draggedIndex < 0 || targetIndex < 0) return;

        const nextVisible = [...visiblePrevious];
        const [dragged] = nextVisible.splice(draggedIndex, 1);
        nextVisible.splice(draggedIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, dragged);
        const next = [...nextVisible, ...previous.filter(isDedicatedStat)];
        setDefinitions(next);
        setDraggedId(null);
        setOrderError(null);
        const mutationVersion = ++definitionOrderVersionRef.current;

        try {
            const persisted = await statService.reorderDefinitions(next.map(def => def.id));
            if (mutationVersion === definitionOrderVersionRef.current) setDefinitions(persisted);
        } catch (e) {
            console.error('Failed to reorder stat definitions:', e);
            if (mutationVersion === definitionOrderVersionRef.current) setDefinitions(previous);
            setOrderError('Failed to save the statistics order.');
            showErrorSnackbar('Failed to save the statistics order.');
        }
    };

    const renderDefinitionRow = (def: StatDefinition, isGroupMember = false) => {
        const isPrimarySelected = def.id === selectedId;
        const isSelected = selectedStatIdSet.has(def.id);
        const isPending = pendingStatCreationsRef.current.has(def.id);
        const rowDraggable = !isPending;

        return (
            <Box
                key={def.id}
                data-stat-id={def.id}
                draggable={rowDraggable}
                onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', def.id);
                    setDraggedId(def.id);
                }}
                onDragEnd={finishDefinitionDragging}
                onDragOver={event => event.preventDefault()}
                onDrop={() => { void handleDefinitionDrop(def.id); }}
                onContextMenu={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isPending) return;
                    setContextMenu({ kind: 'stat', definition: def, top: event.clientY, left: event.clientX });
                }}
                onClick={event => handleDefinitionSelection(def, event)}
                sx={{
                    pl: 2,
                    pr: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    bgcolor: isPrimarySelected
                        ? theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(25,118,210,0.06)'
                        : isSelected
                            ? theme.palette.mode === 'dark'
                                ? 'rgba(255,255,255,0.035)'
                                : 'rgba(25,118,210,0.035)'
                            : isGroupMember
                                ? theme.palette.mode === 'dark'
                                    ? 'rgba(255,255,255,0.035)'
                                    : 'rgba(25,118,210,0.035)'
                                : 'transparent',
                    borderLeft: isPrimarySelected
                        ? `3px solid ${theme.palette.primary.main}`
                        : isSelected
                            ? `3px solid ${theme.palette.primary.light}`
                            : isGroupMember
                                ? `3px solid ${theme.palette.divider}`
                                : '3px solid transparent',
                    transition: 'background-color 0.15s, border-left-color 0.15s',
                    opacity: draggedId === def.id ? 0.45 : 1,
                    '&:hover': {
                        bgcolor: isPrimarySelected
                            ? theme.palette.mode === 'dark'
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(25,118,210,0.09)'
                            : isGroupMember
                                ? theme.palette.mode === 'dark'
                                    ? 'rgba(255,255,255,0.055)'
                                    : 'rgba(25,118,210,0.055)'
                                : theme.palette.action.hover,
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <Typography variant="body2" fontWeight={isPrimarySelected ? 600 : isSelected ? 500 : 400} noWrap>
                            {def.name}
                        </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                        {!isPending && (
                            <StatRecentDots
                                definition={def}
                                refreshKey={resourceRefreshKey + (entryRefreshKeys[def.id] ?? 0)}
                                onEntryChanged={handleEntryChanged}
                                onError={showErrorSnackbar}
                            />
                        )}
                    </Stack>
                </Stack>
            </Box>
        );
    };

    return (
        <PageWrapper>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>

                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, flexShrink: 0 }}>
                    <Typography variant="h5" fontWeight={600}>Statistics</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            startIcon={<CreateNewFolderOutlinedIcon />}
                            variant="outlined"
                            size="small"
                            onClick={() => openCreateGroupDialog()}
                        >
                            Add group
                        </Button>
                        <Button
                            startIcon={<AddIcon />}
                            variant="outlined"
                            size="small"
                            onClick={() => showCreateForm ? closeCreateStatDialog() : openCreateStatDialog()}
                        >
                            {showCreateForm ? 'Cancel' : 'Add Stat'}
                        </Button>
                    </Stack>
                </Stack>

                <Dialog
                    open={showCreateForm}
                    onClose={closeCreateStatDialog}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>
                        {createStatGroupTarget ? `Add statistic to ${createStatGroupTarget.name}` : 'Add statistic'}
                    </DialogTitle>
                    <DialogContent dividers sx={{ p: 1.5 }}>
                        <CreateStatForm
                            onCreated={handleCreated}
                            onCreatedOptimistically={handleCreatedOptimistically}
                            onCreationFailed={handleCreationFailed}
                            existingDefinitions={definitions}
                            onCancel={closeCreateStatDialog}
                        />
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={Boolean(editTarget)}
                    onClose={() => setEditTarget(null)}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Edit statistic</DialogTitle>
                    <DialogContent dividers sx={{ p: 1.5 }}>
                        {editTarget && (
                            <CreateStatForm
                                initialDefinition={editTarget}
                                existingDefinitions={definitions}
                                onUpdated={handleUpdated}
                                onUpdatedOptimistically={handleUpdatedOptimistically}
                                onUpdateFailed={handleUpdateFailed}
                                onCreateRecurringTask={event => {
                                    const definition = editTarget;
                                    if (!definition) return;
                                    setRecurringTaskAnchorPosition(popupPositionForElement(event.currentTarget));
                                    setEditTarget(null);
                                    setRecurringTaskError(null);
                                    setRecurringTaskMode('create');
                                    setRecurringTaskInitialDraft(null);
                                    setRecurringTaskTarget(definition);
                                }}
                                onEditRecurringTask={event => {
                                    const definition = editTarget;
                                    if (!definition) return;
                                    const anchorPosition = popupPositionForElement(event.currentTarget);
                                    setEditTarget(null);
                                    openRecurringTaskEditor(definition, anchorPosition);
                                }}
                                onDelete={() => setDeleteTarget(editTarget)}
                                onCancel={() => setEditTarget(null)}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                <StatCreateLinkedTaskDialog
                    open={Boolean(createLinkedTaskTarget)}
                    definition={createLinkedTaskTarget}
                    anchorPosition={createLinkedTaskAnchorPosition}
                    saving={Boolean(createLinkedTaskTarget && createLinkedTaskSavingId === createLinkedTaskTarget.id)}
                    error={createLinkedTaskError}
                    onClose={() => {
                        if (createLinkedTaskSavingId === null) {
                            setCreateLinkedTaskTarget(null);
                            setCreateLinkedTaskAnchorPosition(null);
                            setCreateLinkedTaskError(null);
                        }
                    }}
                    onCreate={(taskName, importance) => {
                        if (createLinkedTaskTarget) {
                            handleCreateLinkedTask(createLinkedTaskTarget, taskName, importance);
                        }
                    }}
                    onCreateRecurring={(taskName, recurrence) => {
                        if (createLinkedTaskTarget) {
                            handleCreateRecurringLinkedTask(createLinkedTaskTarget, taskName, recurrence);
                        }
                    }}
                />

                <StatRecurringTaskDialog
                    open={Boolean(recurringTaskTarget)}
                    definition={recurringTaskTarget}
                    anchorPosition={recurringTaskAnchorPosition}
                    saving={Boolean(recurringTaskTarget && recurringTaskSavingId === recurringTaskTarget.id)}
                    error={recurringTaskError}
                    initialDraft={recurringTaskInitialDraft}
                    title={recurringTaskMode === 'update' ? 'Change recurring task schedule' : 'Create recurring task'}
                    confirmLabel={recurringTaskMode === 'update' ? 'Save schedule' : 'Create task'}
                    onClose={() => {
                        if (recurringTaskSavingId === null) {
                            setRecurringTaskTarget(null);
                            setRecurringTaskAnchorPosition(null);
                            setRecurringTaskError(null);
                            setRecurringTaskInitialDraft(null);
                        }
                    }}
                    onConfirm={draft => {
                        if (recurringTaskTarget) handleSaveRecurringTask(recurringTaskTarget, draft);
                    }}
                />

                <StatFocusTaskDialog
                    open={Boolean(focusTaskTarget)}
                    definition={focusTaskTarget}
                    linkedTaskNames={focusTaskTarget?.focusTaskNames
                        ?? (focusTaskTarget?.focusTaskName ? [focusTaskTarget.focusTaskName] : [])}
                    anchorPosition={focusTaskAnchorPosition}
                    saving={Boolean(focusTaskTarget && focusTaskSavingId === focusTaskTarget.id)}
                    error={focusTaskError}
                    onClose={() => {
                        if (focusTaskSavingId === null) {
                            setFocusTaskTarget(null);
                            setFocusTaskAnchorPosition(null);
                            setFocusTaskError(null);
                        }
                    }}
                    onAdd={taskName => {
                        if (focusTaskTarget) handleAddFocusTask(focusTaskTarget, taskName);
                    }}
                    onRemove={taskName => {
                        if (focusTaskTarget) handleRemoveFocusTask(focusTaskTarget, taskName);
                    }}
                />

                <Dialog
                    open={groupDialogOpen}
                    onClose={closeGroupDialog}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>{groupEditTarget ? 'Rename statistic group' : 'Create statistic group'}</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            autoComplete="off"
                            fullWidth
                            label="Group name"
                            value={groupName}
                            onChange={event => setGroupName(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void saveGroup();
                                }
                            }}
                            disabled={groupSaving}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeGroupDialog} disabled={groupSaving}>Cancel</Button>
                        <Button onClick={() => { void saveGroup(); }} variant="contained" disabled={groupSaving || !groupName.trim()}>
                            {groupEditTarget ? 'Save' : 'Create'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {loading && <StatsLoadingState />}
                {error && <Alert severity="error">{error}</Alert>}
                {orderError && <Alert severity="error" sx={{ mb: 1.5 }}>{orderError}</Alert>}
                {groupOrderError && <Alert severity="error" sx={{ mb: 1.5 }}>{groupOrderError}</Alert>}
                {groupError && <Alert severity="error" sx={{ mb: 1.5 }}>{groupError}</Alert>}
                {selectionError && <Alert severity="error" sx={{ mb: 1.5 }}>{selectionError}</Alert>}
                {recurringTaskError && <Alert severity="error" sx={{ mb: 1.5 }}>{recurringTaskError}</Alert>}

                {!loading && !error && visibleDefinitions.length === 0 && groups.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 10 }}>
                        <Typography variant="h6" color="text.secondary">No stats yet</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Click "Add Stat" above to start tracking something.
                        </Typography>
                    </Box>
                )}

                {!loading && !error && (visibleDefinitions.length > 0 || groups.length > 0) && (
                    <Box sx={{
                        display: 'flex',
                        flex: 1,
                        gap: 2,
                        overflow: 'hidden',
                        minHeight: 0,
                        flexDirection: { xs: 'column', md: 'row' },
                    }}>

                        {/* Left panel — definition list */}
                        <Box sx={{
                            width: { xs: '100%', md: 360 },
                            flexShrink: 0,
                            overflowY: 'auto',
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: { xs: 0, md: 0 },
                            maxHeight: { xs: 270, md: 'none' },
                        }}>
                            {groupedDefinitions.map(({ group, definitions: groupDefinitions }) => {
                                const expanded = loadedGroupPreferencesKey === groupPreferencesKey
                                    && openGroupIds.has(group.groupId);
                                const collapsed = !expanded;
                                const mounted = mountedGroupIds.has(group.groupId);
                                const groupDragging = draggedGroupId === group.groupId;
                                const groupDragTarget = dragTargetGroupId === group.groupId;
                                const statDropTarget = draggedId !== null && groupDragTarget;
                                const groupDraggable = true;
                                return (
                                    <Box
                                        component="section"
                                        key={group.groupId}
                                        sx={{ flex: '0 0 auto', width: '100%', minWidth: 0 }}
                                    >
                                        <Box
                                            data-stat-group-header="true"
                                            role="button"
                                            tabIndex={0}
                                            aria-expanded={!collapsed}
                                            onClick={() => toggleGroup(group.groupId)}
                                            onKeyDown={event => {
                                                if (event.target !== event.currentTarget) return;
                                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                                event.preventDefault();
                                                toggleGroup(group.groupId);
                                            }}
                                            draggable={groupDraggable}
                                            onMouseDownCapture={event => {
                                                const target = event.target;
                                                const interactive = target instanceof Element
                                                    && target.closest(
                                                        'button, input, textarea, select, [role="button"], .MuiButtonBase-root, [contenteditable="true"]',
                                                    ) !== null;
                                                event.currentTarget.draggable = groupDraggable && !interactive;
                                            }}
                                            onMouseUpCapture={event => {
                                                event.currentTarget.draggable = groupDraggable;
                                            }}
                                            onDragStart={event => {
                                                event.dataTransfer.effectAllowed = 'move';
                                                event.dataTransfer.setData('text/plain', `group:${group.groupId}`);
                                                setDraggedGroupId(group.groupId);
                                                setDragTargetGroupId(null);
                                                setDragTargetGroupPosition(null);
                                            }}
                                            onDragOver={event => {
                                                if (draggedId !== null) {
                                                    event.preventDefault();
                                                    event.dataTransfer.dropEffect = 'move';
                                                    setDragTargetGroupId(group.groupId);
                                                    setDragTargetGroupPosition(null);
                                                    return;
                                                }
                                                if (draggedGroupId === null || draggedGroupId === group.groupId) return;
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                                const bounds = event.currentTarget.getBoundingClientRect();
                                                setDragTargetGroupId(group.groupId);
                                                setDragTargetGroupPosition(
                                                    event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
                                                );
                                            }}
                                            onDrop={event => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (draggedId !== null) {
                                                    void handleDefinitionDropIntoGroup(group.groupId);
                                                    return;
                                                }
                                                const bounds = event.currentTarget.getBoundingClientRect();
                                                const position = event.clientY < bounds.top + bounds.height / 2
                                                    ? 'before'
                                                    : 'after';
                                                void handleGroupDrop(group.groupId, position);
                                            }}
                                            onContextMenu={event => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setContextMenu({
                                                    kind: 'group',
                                                    group,
                                                    top: event.clientY,
                                                    left: event.clientX,
                                                });
                                            }}
                                            onDragEnd={finishGroupDragging}
                                            sx={{
                                                width: '100%',
                                                position: 'relative',
                                                px: 1.5,
                                                py: 0.75,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5,
                                                borderBottom: `1px solid ${theme.palette.divider}`,
                                                bgcolor: statDropTarget
                                                    ? theme.palette.action.selected
                                                    : theme.palette.action.hover,
                                                boxShadow: statDropTarget
                                                    ? `inset 0 0 0 2px ${theme.palette.primary.main}`
                                                    : 'none',
                                                opacity: groupDragging ? 0.45 : 1,
                                                transform: groupDragging ? 'scale(0.98)' : 'scale(1)',
                                                transition: 'opacity 0.16s, transform 0.16s, background-color 0.18s',
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: theme.palette.action.selected },
                                                '&::before': groupDragTarget && dragTargetGroupPosition ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: dragTargetGroupPosition === 'before' ? 0 : 'auto',
                                                    bottom: dragTargetGroupPosition === 'after' ? 0 : 'auto',
                                                    left: 10,
                                                    right: 10,
                                                    height: 2,
                                                    borderRadius: 2,
                                                    backgroundColor: 'primary.main',
                                                } : undefined,
                                            }}
                                        >
                                            <IconButton
                                                size="small"
                                                aria-label={collapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    toggleGroup(group.groupId);
                                                }}
                                            >
                                                {collapsed
                                                    ? <FolderIcon sx={{ fontSize: 20 }} />
                                                    : <FolderOpenOutlinedIcon sx={{ fontSize: 21, color: 'primary.main' }} />}
                                            </IconButton>
                                            <Typography variant="body2" fontWeight={650} noWrap sx={{ minWidth: 0 }}>
                                                {group.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                                {groupDefinitions.length}
                                            </Typography>
                                        </Box>
                                        <Collapse
                                            in={!collapsed}
                                            timeout={{ enter: 220, exit: 180 }}
                                            sx={{
                                                display: 'block',
                                                width: '100%',
                                                flex: '0 0 auto',
                                                overflow: 'hidden',
                                                '& .MuiCollapse-wrapper': {
                                                    display: 'block',
                                                    width: '100%',
                                                    willChange: 'height',
                                                },
                                                '& .MuiCollapse-wrapperInner': {
                                                    width: '100%',
                                                },
                                            }}
                                        >
                                            {mounted && (
                                                <Box>
                                                    {groupDefinitions.length > 0
                                                        ? groupDefinitions.map(definition => renderDefinitionRow(definition, true))
                                                        : (
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{ display: 'block', px: 6.5, py: 1.25, borderBottom: `1px solid ${theme.palette.divider}` }}
                                                            >
                                                                No stats in this group yet
                                                            </Typography>
                                                        )}
                                                </Box>
                                            )}
                                        </Collapse>
                                    </Box>
                                );
                            })}
                            {ungroupedDefinitions.map(definition => renderDefinitionRow(definition))}
                        </Box>

                        {/* Right panel — selected stat chart */}
                        <Box sx={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                            {selectedDef ? (
                                <StatCard
                                    definition={selectedDef}
                                    comparisonDefinitions={selectableDefinitions}
                                    refreshKey={resourceRefreshKey + (entryRefreshKeys[selectedDef.id] ?? 0)}
                                    onEntryChanged={handleEntryChanged}
                                    onError={showErrorSnackbar}
                                    onDateContextMenu={(date, event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setDayContextMenu({ date, top: event.clientY, left: event.clientX });
                                    }}
                                />
                            ) : (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                }}>
                                    <Typography color="text.secondary">
                                        Select a stat to view its history
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            {selectedStatIds.length > 1 && selectionActionsPosition && (
                <Box
                    ref={selectionActionsRef}
                    onClick={event => event.stopPropagation()}
                    sx={{
                        position: 'fixed',
                        top: selectionActionsPosition.top,
                        left: selectionActionsPosition.left,
                        zIndex: 1300,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                        p: 0.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2.5,
                        backgroundColor: 'background.paper',
                        boxShadow: 4,
                        transform: 'translateY(-50%)',
                        animation: `${selectionActionsReveal} 180ms ease-out`,
                    }}
                >
                    <IconButton
                        size="small"
                        color="inherit"
                        aria-label="Group selected stats"
                        title="Group selected stats"
                        onClick={() => openCreateGroupDialog(selectedStatIds)}
                        disabled={groupSaving || deleteSubmitting || selectedDefinitions.length < 2}
                    >
                        <GroupWorkIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete selected stats"
                        title="Delete selected stats"
                        onClick={() => setBulkDeleteTargets(selectedDeletableDefinitions)}
                        disabled={groupSaving || deleteSubmitting || selectedDefinitions.length === 0
                            || selectedDeletableDefinitions.length !== selectedDefinitions.length}
                    >
                        <DeleteSweepIcon fontSize="small" />
                    </IconButton>
                </Box>
            )}

            <Menu
                open={Boolean(contextMenu)}
                onClose={closeContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={contextMenu
                    ? { top: contextMenu.top, left: contextMenu.left }
                    : undefined}
                MenuListProps={{ dense: true }}
            >
                {contextMenu?.kind === 'stat' && !contextMenu.definition.systemKey && (
                    <MenuItem
                        onClick={() => {
                            const definition = contextMenu.definition;
                            const anchorPosition = { top: contextMenu.top, left: contextMenu.left };
                            closeContextMenu();
                            setCreateLinkedTaskError(null);
                            setCreateLinkedTaskAnchorPosition(anchorPosition);
                            setCreateLinkedTaskTarget(definition);
                        }}
                        disabled={createLinkedTaskSavingId !== null}
                    >
                        <ListItemIcon><AddTaskOutlinedIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Create linked task</ListItemText>
                    </MenuItem>
                )}
                {contextMenu?.kind === 'stat' && !contextMenu.definition.systemKey && (
                    <MenuItem
                        onClick={() => {
                            const definition = contextMenu.definition;
                            const anchorPosition = { top: contextMenu.top, left: contextMenu.left };
                            closeContextMenu();
                            setFocusTaskError(null);
                            setFocusTaskAnchorPosition(anchorPosition);
                            setFocusTaskTarget(definition);
                        }}
                        disabled={focusTaskSavingId !== null}
                    >
                        <ListItemIcon><LinkOutlinedIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Link existing task</ListItemText>
                    </MenuItem>
                )}
                {contextMenu?.kind === 'stat'
                    && (!contextMenu.definition.systemKey || isEditableSystemStat(contextMenu.definition)) && (
                    <MenuItem onClick={() => {
                        setEditTarget(contextMenu.definition);
                        closeContextMenu();
                    }}>
                        <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Edit stat</ListItemText>
                    </MenuItem>
                )}
                {contextMenu?.kind === 'stat' && !contextMenu.definition.systemKey && (
                    <MenuItem
                        onClick={() => {
                            setDeleteTarget(contextMenu.definition);
                            closeContextMenu();
                        }}
                        sx={{ color: 'error.main' }}
                    >
                        <ListItemIcon sx={{ color: 'inherit' }}>
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Delete stat</ListItemText>
                    </MenuItem>
                )}
                {contextMenu?.kind === 'stat'
                    && contextMenu.definition.systemKey
                    && !isEditableSystemStat(contextMenu.definition) && (
                    <MenuItem disabled>Built-in statistic</MenuItem>
                )}
                {contextMenu?.kind === 'group' && (
                    <>
                        <MenuItem onClick={() => {
                            openCreateStatDialog(contextMenu.group);
                            closeContextMenu();
                        }}>
                            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Add statistic to this group</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => {
                            openRenameGroupDialog(contextMenu.group);
                            closeContextMenu();
                        }}>
                            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Rename group</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => {
                            setDeleteGroupTarget(contextMenu.group);
                            closeContextMenu();
                        }}>
                            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Delete group</ListItemText>
                        </MenuItem>
                    </>
                )}
            </Menu>

            <Menu
                open={Boolean(dayContextMenu)}
                onClose={() => setDayContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={dayContextMenu
                    ? { top: dayContextMenu.top, left: dayContextMenu.left }
                    : undefined}
                MenuListProps={{ dense: true }}
            >
                <MenuItem onClick={() => {
                    if (dayContextMenu) navigate(`/day/${dayContextMenu.date}`, { state: { returnTo: '/stats' } });
                    setDayContextMenu(null);
                }}>
                    <ListItemIcon><ViewDayIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>View day</ListItemText>
                </MenuItem>
            </Menu>

            {/* Deleting a group only removes its organization metadata. */}
            <Dialog open={Boolean(deleteGroupTarget)} onClose={() => setDeleteGroupTarget(null)}>
                <DialogTitle>Delete "{deleteGroupTarget?.name}"?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        The stats will stay intact and become ungrouped.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteGroupTarget(null)}>Cancel</Button>
                    <Button color="error" onClick={() => { void deleteGroup(); }}>Delete group</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(bulkDeleteTargets)}
                onClose={() => { if (!deleteSubmitting) setBulkDeleteTargets(null); }}
            >
                <DialogTitle>Delete {bulkDeleteTargets?.length ?? 0} statistics?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently delete the selected statistics and all their recorded data. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDeleteTargets(null)} disabled={deleteSubmitting}>Cancel</Button>
                    <Button color="error" onClick={() => { void handleBulkDeleteConfirm(); }} disabled={deleteSubmitting}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently delete the stat and all its recorded data. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button color="error" onClick={handleDeleteConfirm}>Delete</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(errorSnackbar)}
                autoHideDuration={5000}
                onClose={() => setErrorSnackbar(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="error" onClose={() => setErrorSnackbar(null)} sx={{ width: '100%' }}>
                    {errorSnackbar}
                </Alert>
            </Snackbar>
            <Snackbar
                open={Boolean(recurringTaskFeedback)}
                autoHideDuration={4000}
                onClose={() => setRecurringTaskFeedback(null)}
                message={recurringTaskFeedback ?? ''}
            />
            <Snackbar
                open={Boolean(focusTaskFeedback)}
                autoHideDuration={4000}
                onClose={() => setFocusTaskFeedback(null)}
                message={focusTaskFeedback ?? ''}
            />
        </PageWrapper>
    );
}

export default StatsPage;
