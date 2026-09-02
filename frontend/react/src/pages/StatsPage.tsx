import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import {
    Box, Button, Typography, Alert, Stack, Skeleton,
    Tooltip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogContentText, DialogActions, TextField, Collapse,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import AddIcon from '@mui/icons-material/Add';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { PageWrapper } from '../components/PageWrapper';
import { CreateStatForm } from '../components/stats/CreateStatForm';
import { StatRecentDots } from '../components/stats/StatRecentDots';
import { StatCard } from '../components/stats/StatCard';
import { StatDefinition } from '../types/Stats';
import { StatGroup } from '../types/StatGroup';
import { statService } from '../services/api/statService';
import { statGroupService } from '../services/api/statGroupService';

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

const STAT_ACTIONS_WIDTH = 32;
const STAT_ACTION_ICON_SIZE = 30;
const SELECTION_ACTIONS_EDGE_PADDING = 12;
const SELECTION_ACTIONS_GAP = 12;
const SELECTION_ACTIONS_FALLBACK_WIDTH = 88;

type GroupDropPosition = 'before' | 'after';

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
    const [definitions, setDefinitions] = useState<StatDefinition[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedStatIds, setSelectedStatIds] = useState<string[]>([]);
    const [selectionActionsPosition, setSelectionActionsPosition] = useState<{ top: number; left: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editTarget, setEditTarget] = useState<StatDefinition | null>(null);
    const [chartRefreshKey, setChartRefreshKey] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<StatDefinition | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [reorderSaving, setReorderSaving] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [groups, setGroups] = useState<StatGroup[]>([]);
    const [groupError, setGroupError] = useState<string | null>(null);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupEditTarget, setGroupEditTarget] = useState<StatGroup | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupSaving, setGroupSaving] = useState(false);
    const [deleteGroupTarget, setDeleteGroupTarget] = useState<StatGroup | null>(null);
    const [groupCreateDefinitionIds, setGroupCreateDefinitionIds] = useState<string[]>([]);
    const [groupOrderSaving, setGroupOrderSaving] = useState(false);
    const [groupMembershipSaving, setGroupMembershipSaving] = useState(false);
    const [groupOrderError, setGroupOrderError] = useState<string | null>(null);
    const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
    const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
    const [dragTargetGroupPosition, setDragTargetGroupPosition] = useState<GroupDropPosition | null>(null);
    const [bulkDeleteTargets, setBulkDeleteTargets] = useState<StatDefinition[] | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const selectionAnchorRef = useRef<string | null>(null);
    const selectionActionsRef = useRef<HTMLDivElement | null>(null);

    const loadDefinitions = useCallback(() => {
        return statService.getDefinitions()
            .then(defs => {
                setDefinitions(defs);
                setSelectedId(prev => {
                    const visibleDefs = defs.filter(definition => !isDedicatedStat(definition));
                    if (prev && visibleDefs.some(d => d.id === prev)) return prev;
                    return visibleDefs[0]?.id ?? null;
                });
                setSelectedStatIds(previous => previous.filter(id =>
                    defs.some(definition => !isDedicatedStat(definition) && definition.id === id),
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

    const handleEntryChanged = useCallback(() => {
        setChartRefreshKey(key => key + 1);
    }, []);

    const handleCreated = (def: StatDefinition) => {
        setDefinitions(prev => [...prev, def]);
        setSelectedId(def.id);
        setSelectedStatIds([def.id]);
        selectionAnchorRef.current = def.id;
        setShowCreateForm(false);
    };

    const handleUpdated = (updated: StatDefinition) => {
        setDefinitions(prev => prev.map(definition =>
            definition.id === updated.id ? updated : definition,
        ));
        setEditTarget(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await statService.deleteDefinition(deleteTarget.id);
            setDefinitions(prev => {
                const next = prev.filter(d => d.id !== deleteTarget.id);
                const nextVisible = next.filter(definition => !isDedicatedStat(definition));
                setSelectedId(current => {
                    if (current !== deleteTarget.id) return current;
                    return nextVisible[0]?.id ?? null;
                });
                return next;
            });
            setGroups(prev => prev.map(group => ({
                ...group,
                statDefinitionIds: group.statDefinitionIds.filter(id => id !== deleteTarget.id),
            })));
            setSelectedStatIds(previous => previous.filter(id => id !== deleteTarget.id));
            if (selectionAnchorRef.current === deleteTarget.id) selectionAnchorRef.current = null;
            setEditTarget(null);
        } catch (e) {
            console.error('Failed to delete stat definition:', e);
        } finally {
            setDeleteTarget(null);
        }
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

    const saveGroup = async () => {
        const trimmedName = groupName.trim();
        if (!trimmedName || groupSaving) return;

        setGroupSaving(true);
        setGroupError(null);
        try {
            if (groupEditTarget) {
                const updatedGroup = await statGroupService.renameGroup(groupEditTarget.groupId, trimmedName);
                setGroups(prev => prev.map(group =>
                    group.groupId === updatedGroup.groupId ? updatedGroup : group,
                ));
            } else {
                const createdGroup = await statGroupService.createGroup(trimmedName, groupCreateDefinitionIds);
                const selectedDefinitionIdSet = new Set(groupCreateDefinitionIds);
                setGroups(prev => [
                    ...prev.map(group => ({
                        ...group,
                        statDefinitionIds: group.statDefinitionIds.filter(id => !selectedDefinitionIdSet.has(id)),
                    })),
                    createdGroup,
                ]);
                if (groupCreateDefinitionIds.length > 1) {
                    clearSelection();
                    setCollapsedGroupIds(prev => new Set(prev).add(createdGroup.groupId));
                }
            }
            closeGroupDialog();
        } catch (e) {
            console.error('Failed to save stat group:', e);
            setGroupError('Could not save this statistic group.');
        } finally {
            setGroupSaving(false);
        }
    };

    const deleteGroup = async () => {
        if (!deleteGroupTarget) return;

        const groupToDelete = deleteGroupTarget;
        setGroupError(null);
        try {
            await statGroupService.deleteGroup(groupToDelete.groupId);
            setGroups(prev => prev.filter(group => group.groupId !== groupToDelete.groupId));
            setCollapsedGroupIds(prev => {
                const next = new Set(prev);
                next.delete(groupToDelete.groupId);
                return next;
            });
        } catch (e) {
            console.error('Failed to delete stat group:', e);
            setGroupError('Could not delete this statistic group.');
        } finally {
            setDeleteGroupTarget(null);
        }
    };

    const toggleGroup = (groupId: string) => {
        setCollapsedGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const visibleDefinitions = definitions.filter(definition => !isDedicatedStat(definition));
    const selectedDef = visibleDefinitions.find(d => d.id === selectedId) ?? null;
    const selectedStatIdSet = useMemo(() => new Set(selectedStatIds), [selectedStatIds]);
    const selectedDefinitions = useMemo(
        () => visibleDefinitions.filter(definition => selectedStatIdSet.has(definition.id)),
        [selectedStatIdSet, visibleDefinitions],
    );
    const selectedDeletableDefinitions = useMemo(
        () => selectedDefinitions.filter(definition => !definition.systemKey),
        [selectedDefinitions],
    );
    const groupedDefinitions = groups.map(group => ({
        group,
        definitions: visibleDefinitions.filter(definition => group.statDefinitionIds.includes(definition.id)),
    }));
    const ungroupedDefinitions = visibleDefinitions.filter(definition =>
        !groups.some(group => group.statDefinitionIds.includes(definition.id)),
    );

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
    }, [collapsedGroupIds, definitions, groups, selectedStatIdSet, selectedStatIds.length,
        updateSelectionActionsPosition]);

    const handleDefinitionSelection = (definition: StatDefinition, event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        const definitionId = definition.id;
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

    const handleBulkDeleteConfirm = async () => {
        if (!bulkDeleteTargets || deleteSubmitting) return;

        const targets = bulkDeleteTargets;
        const targetIds = new Set(targets.map(definition => definition.id));
        setDeleteSubmitting(true);
        setSelectionError(null);
        try {
            await Promise.all(targets.map(definition => statService.deleteDefinition(definition.id)));
            setDefinitions(previous => {
                const next = previous.filter(definition => !targetIds.has(definition.id));
                setSelectedId(current => targetIds.has(current ?? '')
                    ? next.filter(definition => !isDedicatedStat(definition))[0]?.id ?? null
                    : current);
                return next;
            });
            setGroups(previous => previous.map(group => ({
                ...group,
                statDefinitionIds: group.statDefinitionIds.filter(id => !targetIds.has(id)),
            })));
            clearSelection();
            setBulkDeleteTargets(null);
        } catch (e) {
            console.error('Failed to delete selected stat definitions:', e);
            setSelectionError('Could not delete the selected statistics.');
            void loadDefinitions();
            void loadGroups();
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const finishDefinitionDragging = () => {
        setDraggedId(null);
        setDragTargetGroupId(null);
        setDragTargetGroupPosition(null);
    };

    const handleDefinitionDropIntoGroup = async (targetGroupId: string) => {
        if (!draggedId || groupMembershipSaving) return;

        const definitionId = draggedId;
        const previous = groups;
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
        setGroupMembershipSaving(true);

        try {
            const persistedTargetGroup = await statGroupService.replaceDefinitions(
                targetGroupId,
                next.find(group => group.groupId === targetGroupId)!.statDefinitionIds,
            );
            setGroups(current => current.map(group =>
                group.groupId === persistedTargetGroup.groupId ? persistedTargetGroup : group,
            ));
        } catch (e) {
            console.error('Failed to move stat into group:', e);
            setGroups(previous);
            setGroupError('Could not move this statistic into the group.');
        } finally {
            setGroupMembershipSaving(false);
        }
    };

    const handleGroupDrop = async (targetGroupId: string, dropPosition?: GroupDropPosition) => {
        if (!draggedGroupId || draggedGroupId === targetGroupId || groupOrderSaving || groupMembershipSaving) return;

        const previous = groups;
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
        setGroupOrderSaving(true);

        try {
            const persisted = await statGroupService.reorderGroups(next.map(group => group.groupId));
            setGroups(persisted);
        } catch (e) {
            console.error('Failed to reorder stat groups:', e);
            setGroups(previous);
            setGroupOrderError('Failed to save the statistic group order.');
        } finally {
            setGroupOrderSaving(false);
        }
    };

    const finishGroupDragging = () => {
        setDraggedGroupId(null);
        setDragTargetGroupId(null);
        setDragTargetGroupPosition(null);
    };

    const handleDefinitionDrop = async (targetId: string) => {
        if (!draggedId || draggedId === targetId || reorderSaving) return;

        const previous = definitions;
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
        setReorderSaving(true);

        try {
            const persisted = await statService.reorderDefinitions(next.map(def => def.id));
            setDefinitions(persisted);
        } catch (e) {
            console.error('Failed to reorder stat definitions:', e);
            setDefinitions(previous);
            setOrderError('Failed to save the statistics order.');
        } finally {
            setReorderSaving(false);
        }
    };

    const renderDefinitionRow = (def: StatDefinition, isGroupMember = false) => {
        const isPrimarySelected = def.id === selectedId;
        const isSelected = selectedStatIdSet.has(def.id);
        const rowDraggable = !reorderSaving && !groupOrderSaving && !groupMembershipSaving;

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
                        <StatRecentDots
                            definition={def}
                            refreshKey={chartRefreshKey}
                            onEntryChanged={handleEntryChanged}
                        />
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                            sx={{ flexShrink: 0, width: STAT_ACTIONS_WIDTH }}
                        >
                            {!def.systemKey ? (
                                <Tooltip title="Edit stat">
                                    <IconButton
                                        size="small"
                                        onClick={event => { event.stopPropagation(); setEditTarget(def); }}
                                        sx={{
                                            width: STAT_ACTION_ICON_SIZE,
                                            height: STAT_ACTION_ICON_SIZE,
                                            opacity: 0.5,
                                            '&:hover': { opacity: 1 },
                                        }}
                                    >
                                        <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            ) : (
                                <Box sx={{ width: STAT_ACTION_ICON_SIZE, height: STAT_ACTION_ICON_SIZE }} />
                            )}
                        </Stack>
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
                            onClick={() => setShowCreateForm(s => !s)}
                        >
                            {showCreateForm ? 'Cancel' : 'Add Stat'}
                        </Button>
                    </Stack>
                </Stack>

                <Dialog
                    open={showCreateForm}
                    onClose={() => setShowCreateForm(false)}
                    fullWidth
                    maxWidth="xs"
                >
                    <DialogTitle>Add statistic</DialogTitle>
                    <DialogContent dividers sx={{ p: 1.5 }}>
                        <CreateStatForm
                            onCreated={handleCreated}
                            onCancel={() => setShowCreateForm(false)}
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
                                onUpdated={handleUpdated}
                                onDelete={() => setDeleteTarget(editTarget)}
                                onCancel={() => setEditTarget(null)}
                            />
                        )}
                    </DialogContent>
                </Dialog>

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
                                const collapsed = collapsedGroupIds.has(group.groupId);
                                const groupDragging = draggedGroupId === group.groupId;
                                const groupDragTarget = dragTargetGroupId === group.groupId;
                                const statDropTarget = draggedId !== null && groupDragTarget;
                                const groupDraggable = !groupOrderSaving && !reorderSaving && !groupMembershipSaving;
                                return (
                                    <React.Fragment key={group.groupId}>
                                        <Box
                                            data-stat-group-header="true"
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
                                            onDragEnd={finishGroupDragging}
                                            sx={{
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
                                                onClick={() => toggleGroup(group.groupId)}
                                            >
                                                <KeyboardArrowDownRoundedIcon
                                                    sx={{
                                                        fontSize: 19,
                                                        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                                        transition: theme.transitions.create('transform', {
                                                            duration: theme.transitions.duration.shortest,
                                                        }),
                                                    }}
                                                />
                                            </IconButton>
                                            <FolderOutlinedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                                            <Typography variant="body2" fontWeight={650} noWrap sx={{ minWidth: 0 }}>
                                                {group.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                                {groupDefinitions.length}
                                            </Typography>
                                            <Box sx={{ ml: 'auto', display: 'flex' }}>
                                                <Tooltip title="Rename group">
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Rename ${group.name}`}
                                                        onClick={() => openRenameGroupDialog(group)}
                                                    >
                                                        <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete group">
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Delete ${group.name}`}
                                                        onClick={() => setDeleteGroupTarget(group)}
                                                    >
                                                        <DeleteOutlineOutlinedIcon sx={{ fontSize: 17 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                        <Collapse
                                            in={!collapsed}
                                            timeout={{ enter: 220, exit: 180 }}
                                            unmountOnExit
                                            sx={{
                                                '& .MuiCollapse-wrapper': { willChange: 'height' },
                                            }}
                                        >
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
                                        </Collapse>
                                    </React.Fragment>
                                );
                            })}
                            {ungroupedDefinitions.map(definition => renderDefinitionRow(definition))}
                        </Box>

                        {/* Right panel — selected stat chart */}
                        <Box sx={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                            {selectedDef ? (
                                <StatCard
                                    key={selectedDef.type === 'BOOLEAN' ? 'calendar' : 'numeric-chart'}
                                    definition={selectedDef}
                                    comparisonDefinitions={visibleDefinitions}
                                    onEdit={setEditTarget}
                                    refreshKey={chartRefreshKey}
                                    onEntryChanged={handleEntryChanged}
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
        </PageWrapper>
    );
}

export default StatsPage;
