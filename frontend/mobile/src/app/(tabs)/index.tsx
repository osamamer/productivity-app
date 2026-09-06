import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, unstable_batchedUpdates, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { TaskBulkDateSheet } from '@/components/tasks/TaskBulkDateSheet';
import { TaskGroupComposerSheet } from '@/components/tasks/TaskGroupComposerSheet';
import { TaskSelectionActionsPopup } from '@/components/tasks/TaskSelectionActionsPopup';
import { TaskRow, type TaskDragLayout } from '@/components/tasks/TaskRow';
import { DraggableTaskGroup } from '@/components/tasks/DraggableTaskGroup';
import { GroupChevron } from '@/components/tasks/GroupChevron';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { formatLongDate, greeting } from '@/lib/date';
import { playAudioFeedback } from '@/lib/audioFeedback';
import { reportError } from '@/lib/errors';
import { animateLayout } from '@/lib/motion';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/providers/AuthProvider';
import { useAppPopup } from '@/providers/PopupProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Day, Task, TaskGroup } from '@/types/models';

interface TodayData { day: Day }

type TaskListItem =
  | { kind: 'task'; task: Task }
  | { kind: 'group'; group: TaskGroup; tasks: Task[] };

type DragItemKey = `task:${string}` | `group:${string}`;

interface DragSource {
  kind: 'task' | 'group';
  id: string;
  itemKey: DragItemKey;
  groupId: string | null;
  taskIds: string[];
  height: number;
}

interface DragTarget {
  itemKey: DragItemKey | null;
  edge: 'before' | 'after' | null;
  groupId: string | null;
}

const taskItemKey = (taskId: string): DragItemKey => `task:${taskId}`;
const groupItemKey = (groupId: string): DragItemKey => `group:${groupId}`;
const TASK_LIST_GAP = 10;

function nearestTarget(
  absoluteY: number,
  candidates: [DragItemKey, Pick<TaskDragLayout, 'top' | 'bottom'>][],
): { itemKey: DragItemKey; edge: 'before' | 'after' } | null {
  const nearest = candidates
    .map(([itemKey, layout]) => {
      const midpoint = (layout.top + layout.bottom) / 2;
      const distance = absoluteY < layout.top
        ? layout.top - absoluteY
        : absoluteY > layout.bottom
          ? absoluteY - layout.bottom
          : 0;
      return { itemKey, edge: absoluteY < midpoint ? 'before' as const : 'after' as const, distance };
    })
    .sort((first, second) => first.distance - second.distance)[0];
  return nearest ?? null;
}

function moveTaskBlock(
  orderedTaskIds: string[],
  sourceTaskIds: string[],
  targetTaskIds: string[],
  edge: 'before' | 'after',
): string[] {
  const sourceSet = new Set(sourceTaskIds);
  const remaining = orderedTaskIds.filter(taskId => !sourceSet.has(taskId));
  const source = orderedTaskIds.filter(taskId => sourceSet.has(taskId));
  const targetIndexes = targetTaskIds
    .map(taskId => remaining.indexOf(taskId))
    .filter(index => index >= 0);
  if (!source.length || !targetIndexes.length) return orderedTaskIds;
  const insertionIndex = edge === 'before'
    ? Math.min(...targetIndexes)
    : Math.max(...targetIndexes) + 1;
  remaining.splice(insertionIndex, 0, ...source);
  return remaining;
}

function previewOffsetsForDrag(
  orderedKeys: DragItemKey[],
  sourceKey: DragItemKey,
  targetKey: DragItemKey,
  edge: 'before' | 'after',
  sourceExtent: number,
): Map<DragItemKey, number> {
  const sourceIndex = orderedKeys.indexOf(sourceKey);
  if (sourceIndex < 0) return new Map();

  const remainingKeys = orderedKeys.filter(key => key !== sourceKey);
  const targetIndex = remainingKeys.indexOf(targetKey);
  if (targetIndex < 0) return new Map();

  const insertionIndex = targetIndex + (edge === 'after' ? 1 : 0);
  if (insertionIndex === sourceIndex) return new Map();

  const offsets = new Map<DragItemKey, number>();
  if (insertionIndex > sourceIndex) {
    orderedKeys.slice(sourceIndex + 1, insertionIndex + 1)
      .forEach(key => offsets.set(key, -sourceExtent));
  } else {
    orderedKeys.slice(insertionIndex, sourceIndex)
      .forEach(key => offsets.set(key, sourceExtent));
  }
  return offsets;
}

function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
  const visibleTaskIds = new Set(tasks.map(task => task.taskId));
  const groupByTaskId = new Map<string, TaskGroup>();
  [...groups]
    .filter(group => group.taskIds.length >= 2)
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .forEach(group => group.taskIds.forEach(taskId => {
      if (visibleTaskIds.has(taskId) && !groupByTaskId.has(taskId)) groupByTaskId.set(taskId, group);
    }));

  const emittedGroupIds = new Set<string>();
  return tasks.reduce<TaskListItem[]>((items, task) => {
    const group = groupByTaskId.get(task.taskId);
    if (!group) {
      items.push({ kind: 'task', task });
    } else if (!emittedGroupIds.has(group.groupId)) {
      emittedGroupIds.add(group.groupId);
      items.push({
        kind: 'group',
        group,
        tasks: tasks.filter(candidate => groupByTaskId.get(candidate.taskId)?.groupId === group.groupId),
      });
    }
    return items;
  }, []);
}

export default function TodayScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { confirm, showError } = useAppPopup();
  const resource = useAsyncData<TodayData>(async () => ({ day: await api.day.today() }));
  const {
    allTasks,
    todayTasks,
    groups,
    addTask,
    updateTask: updateTaskInWorkspace,
    removeTask: removeTaskFromWorkspace,
    loading: tasksLoading,
    refresh: refreshTasks,
    moveTasksToDate,
    reorderTasks,
    replaceGroupTasks,
  } = useTaskWorkspace();
  const { showCompletedTasks } = usePreferences();
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [groupTaskComposer, setGroupTaskComposer] = useState<TaskGroup | null>(null);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkDateSaving, setBulkDateSaving] = useState(false);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragTargetItemKey, setDragTargetItemKey] = useState<DragItemKey | null>(null);
  const [dragTargetEdge, setDragTargetEdge] = useState<'before' | 'after' | null>(null);
  const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
  const taskLayoutsRef = useRef(new Map<string, TaskDragLayout>());
  const taskRowRefs = useRef(new Map<string, View>());
  const groupLayoutsRef = useRef(new Map<string, Pick<TaskDragLayout, 'top' | 'bottom'>>());
  const itemLayoutsRef = useRef(new Map<DragItemKey, Pick<TaskDragLayout, 'top' | 'bottom'>>());
  const dragSourceRef = useRef<DragSource | null>(null);
  const groupRefs = useRef(new Map<string, View>());
  const dragTargetRef = useRef<DragTarget>({ itemKey: null, edge: null, groupId: null });

  function updateTask(updated: Task) {
    updateTaskInWorkspace(updated);
  }

  function removeTask(taskId: string) {
    removeTaskFromWorkspace(taskId);
  }

  function toggleGroup(groupId: string) {
    animateLayout();
    setCollapsedGroupIds(previous => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedGroupTaskIdSet = useMemo(
    () => new Set(groups.filter(group => selectedGroupIdSet.has(group.groupId)).flatMap(group => group.taskIds)),
    [groups, selectedGroupIdSet],
  );
  const selectedTaskActionIds = useMemo(
    () => [...new Set([...selectedTaskIds, ...selectedGroupTaskIdSet])],
    [selectedGroupTaskIdSet, selectedTaskIds],
  );
  const selectedTasks = useMemo(
    () => allTasks.filter(task => selectedTaskActionIds.includes(task.taskId)),
    [allTasks, selectedTaskActionIds],
  );
  const canGroupSelectedTasks = selectedGroupIds.length === 0 && selectedTaskIds.length >= 2;

  function toggleSelection(taskId: string) {
    setSelectedTaskIds(previous => previous.includes(taskId)
      ? previous.filter(id => id !== taskId)
      : [...previous, taskId]);
  }

  function startSelection(taskId: string) {
    setSelectedTaskIds(previous => previous.includes(taskId) ? previous : [...previous, taskId]);
  }

  function toggleGroupSelection(groupId: string) {
    setSelectedGroupIds(previous => previous.includes(groupId)
      ? previous.filter(id => id !== groupId)
      : [...previous, groupId]);
  }

  function clearSelection() {
    setSelectedTaskIds([]);
    setSelectedGroupIds([]);
    setBulkDateOpen(false);
  }

  function resetDrag() {
    dragSourceRef.current = null;
    setDragSource(null);
    setDragTargetItemKey(null);
    setDragTargetEdge(null);
    setDragTargetGroupId(null);
    dragTargetRef.current = { itemKey: null, edge: null, groupId: null };
  }

  function measureDragItems() {
    taskLayoutsRef.current.clear();
    groupLayoutsRef.current.clear();
    itemLayoutsRef.current.clear();
    const rootTaskIds = new Set(listItems.filter(item => item.kind === 'task').map(item => item.task.taskId));
    taskRowRefs.current.forEach((view, visibleTaskId) => {
      view.measureInWindow((left, top, width, height) => {
        const layout = { left, top, width, bottom: top + height };
        taskLayoutsRef.current.set(visibleTaskId, layout);
        if (rootTaskIds.has(visibleTaskId)) itemLayoutsRef.current.set(taskItemKey(visibleTaskId), layout);
      });
    });
    groupRefs.current.forEach((view, groupId) => {
      view.measureInWindow((_left, top, _width, height) => {
        const layout = { top, bottom: top + height };
        groupLayoutsRef.current.set(groupId, layout);
        itemLayoutsRef.current.set(groupItemKey(groupId), layout);
      });
    });
  }

  function beginDrag(source: DragSource) {
    measureDragItems();
    clearSelection();
    setSelected(null);
    dragSourceRef.current = source;
    setDragSource(source);
    setDragTargetItemKey(null);
    setDragTargetEdge(null);
    setDragTargetGroupId(null);
    dragTargetRef.current = { itemKey: null, edge: null, groupId: null };
  }

  function startTaskDrag(taskId: string, _startY: number) {
    const containingGroup = listItems.find(
      (item): item is Extract<TaskListItem, { kind: 'group' }> => item.kind === 'group' && item.tasks.some(task => task.taskId === taskId),
    );
    beginDrag({
      kind: 'task',
      id: taskId,
      itemKey: taskItemKey(taskId),
      groupId: containingGroup?.group.groupId ?? null,
      taskIds: [taskId],
      height: Math.max(68, (taskLayoutsRef.current.get(taskId)?.bottom ?? 0) - (taskLayoutsRef.current.get(taskId)?.top ?? 0)),
    });
  }

  function startGroupDrag(groupId: string, _startY: number) {
    const group = groups.find(candidate => candidate.groupId === groupId);
    if (!group) return;
    beginDrag({
      kind: 'group',
      id: groupId,
      itemKey: groupItemKey(groupId),
      groupId,
      taskIds: group.taskIds,
      height: Math.max(64, (groupLayoutsRef.current.get(groupId)?.bottom ?? 0) - (groupLayoutsRef.current.get(groupId)?.top ?? 0)),
    });
  }

  function showTarget(target: DragTarget) {
    const current = dragTargetRef.current;
    if (current.itemKey === target.itemKey && current.edge === target.edge && current.groupId === target.groupId) return;
    dragTargetRef.current = target;
    setDragTargetItemKey(target.itemKey);
    setDragTargetEdge(target.edge);
    setDragTargetGroupId(target.groupId);
  }

  function updateDragTarget(id: string, moveY: number, _dy: number) {
    const source = dragSourceRef.current;
    if (!source || source.id !== id) return;

    if (source.kind === 'task') {
      const groupTarget = [...groupLayoutsRef.current.entries()].find(([groupId, layout]) => {
        if (groupId === source.groupId) return false;
        const edgeZone = Math.min(40, (layout.bottom - layout.top) * 0.22);
        return moveY >= layout.top + edgeZone && moveY <= layout.bottom - edgeZone;
      });
      if (groupTarget) {
        showTarget({ itemKey: null, edge: null, groupId: groupTarget[0] });
        return;
      }
    }

    if (source.kind === 'task' && source.groupId) {
      const groupItem = listItems.find(
        (item): item is Extract<TaskListItem, { kind: 'group' }> => item.kind === 'group' && item.group.groupId === source.groupId,
      );
      const orderedKeys = groupItem?.tasks.map(task => taskItemKey(task.taskId)) ?? [];
      const childLayouts = new Map<DragItemKey, Pick<TaskDragLayout, 'top' | 'bottom'>>();
      orderedKeys.forEach(key => {
        const layout = taskLayoutsRef.current.get(key.slice('task:'.length));
        if (layout) childLayouts.set(key, layout);
      });
      const target = nearestTarget(moveY, [...childLayouts.entries()].filter(([key]) => key !== source.itemKey));
      if (!target) {
        showTarget({ itemKey: null, edge: null, groupId: null });
        return;
      }
      showTarget({ itemKey: target.itemKey, edge: target.edge, groupId: null });
      return;
    }

    const target = nearestTarget(moveY, [...itemLayoutsRef.current.entries()].filter(([key]) => key !== source.itemKey));
    if (!target) {
      showTarget({ itemKey: null, edge: null, groupId: null });
      return;
    }
    showTarget({ itemKey: target.itemKey, edge: target.edge, groupId: null });
  }

  async function finishDrag(id: string, _moveY: number) {
    const source = dragSourceRef.current;
    if (!source || source.id !== id) return;
    const target = dragTargetRef.current;
    if (target.groupId && source.kind === 'task') {
      const group = groups.find(candidate => candidate.groupId === target.groupId);
      resetDrag();
      if (group && !group.taskIds.includes(source.id)) {
        try {
          animateLayout();
          await replaceGroupTasks(group.groupId, [...group.taskIds, source.id]);
        } catch (cause) {
          void showError('Could not add task to group', reportError('Could not add task to group', cause));
        }
      }
      return;
    }

    if (!target.itemKey || !target.edge || target.itemKey === source.itemKey) {
      resetDrag();
      return;
    }
    const targetItem = listItems.find(item => (item.kind === 'task'
      ? taskItemKey(item.task.taskId)
      : groupItemKey(item.group.groupId)) === target.itemKey);
    if (!targetItem) {
      resetDrag();
      return;
    }
    const targetTaskIds = targetItem.kind === 'task' ? [targetItem.task.taskId] : targetItem.group.taskIds;
    const rootTaskIds = allTasks.filter(task => !task.parentId).map(task => task.taskId);
    const reorderedTaskIds = moveTaskBlock(rootTaskIds, source.taskIds, targetTaskIds, target.edge);
    try {
      const reorderPromise = unstable_batchedUpdates(() => {
        resetDrag();
        return reorderTasks(reorderedTaskIds);
      });
      await reorderPromise;
    } catch (cause) {
      void showError('Could not reorder tasks', reportError('Could not reorder tasks', cause));
    }
  }

  async function addTaskToGroup(task: Task) {
    const group = groupTaskComposer;
    addTask(task);
    if (!group) return;
    try {
      await replaceGroupTasks(group.groupId, [...group.taskIds, task.taskId]);
    } catch (cause) {
      void showError('Could not add task to group', reportError('Could not add task to group', cause));
    } finally {
      setGroupTaskComposer(null);
    }
  }

  function registerGroupLayout(groupId: string) {
    groupRefs.current.get(groupId)?.measureInWindow((_x, top, _width, height) => {
      groupLayoutsRef.current.set(groupId, { top, bottom: top + height });
    });
  }

  function registerTaskLayout(taskId: string, layout: TaskDragLayout) {
    taskLayoutsRef.current.set(taskId, layout);
  }

  const registerTaskView = useCallback((taskId: string, view: View | null) => {
    if (view) taskRowRefs.current.set(taskId, view);
    else taskRowRefs.current.delete(taskId);
  }, []);

  async function performBulkCompletion(completed: boolean) {
    if (bulkActionLoading || selectedTasks.length === 0) return;
    const tasksToComplete = selectedTasks.filter(task => !task.completed);
    setBulkActionLoading(true);
    try {
      const updated = await Promise.all(selectedTasks.map(task => api.tasks.update(task.taskId, { completed })));
      updated.forEach(updateTask);
      if (completed && tasksToComplete.length > 0) playAudioFeedback('taskCompleted');
      clearSelection();
    } catch (cause) {
      void showError('Could not update tasks', reportError('Could not update tasks', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function moveSelectedToDate(scheduledPerformDateTime: string) {
    if (bulkActionLoading || selectedTasks.length === 0) return;
    setBulkDateSaving(true);
    try {
      await moveTasksToDate(selectedTaskActionIds, scheduledPerformDateTime);
      clearSelection();
    } catch (cause) {
      void showError('Could not move tasks', reportError('Could not move tasks', cause));
    } finally {
      setBulkDateSaving(false);
    }
  }

  async function confirmBulkDelete() {
    if (!selectedTasks.length) return;
    if (!await confirm('Delete selected tasks?', `${selectedTasks.length} tasks will be deleted.`, 'Delete')) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(selectedTasks.map(task => api.tasks.remove(task.taskId)));
      selectedTasks.forEach(task => removeTask(task.taskId));
      clearSelection();
    } catch (cause) {
      void showError('Could not delete tasks', reportError('Could not delete tasks', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function toggle(task: Task) {
    const optimistic = { ...task, completed: !task.completed };
    updateTask(optimistic);
    try {
      const updated = await api.tasks.update(task.taskId, { completed: optimistic.completed });
      updateTask(updated);
      if (optimistic.completed) playAudioFeedback('taskCompleted');
    } catch (cause) {
      updateTask(task);
      void showError('Could not update task', reportError('Could not update task', cause));
    }
  }

  const name = user?.firstName || user?.username;
  const listItems = buildTaskListItems(
    todayTasks.filter(task => showCompletedTasks || !task.completed),
    groups,
  );
  const groupableTodayTasks = todayTasks.filter(
    task => !task.parentId && (showCompletedTasks || !task.completed),
  );
  const selectionActive = selectedTaskIds.length > 0 || selectedGroupIds.length > 0;
  const draggedTaskId = dragSource?.kind === 'task' ? dragSource.id : null;
  const draggedGroupId = dragSource?.kind === 'group' ? dragSource.id : null;
  const dragPreviewOffsets = (() => {
    if (!dragSource || !dragTargetItemKey || !dragTargetEdge || dragTargetGroupId) return new Map<DragItemKey, number>();
    if (dragSource.kind === 'task' && dragSource.groupId) {
      const sourceGroup = listItems.find(
        (item): item is Extract<TaskListItem, { kind: 'group' }> => item.kind === 'group' && item.group.groupId === dragSource.groupId,
      );
      return previewOffsetsForDrag(
        sourceGroup?.tasks.map(task => taskItemKey(task.taskId)) ?? [],
        dragSource.itemKey,
        dragTargetItemKey,
        dragTargetEdge,
        dragSource.height,
      );
    }
    return previewOffsetsForDrag(
      listItems.map(item => item.kind === 'task' ? taskItemKey(item.task.taskId) : groupItemKey(item.group.groupId)),
      dragSource.itemKey,
      dragTargetItemKey,
      dragTargetEdge,
      dragSource.height + TASK_LIST_GAP,
    );
  })();
  const completed = todayTasks.filter(task => task.completed).length;
  const remaining = todayTasks.length - completed;
  const progress = todayTasks.length ? completed / todayTasks.length : 0;

  async function refreshToday() {
    await Promise.all([resource.reload(), refreshTasks()]);
  }

  return (
    <Screen
      refreshing={resource.refreshing || tasksLoading}
      refreshEnabled={dragSource === null}
      onRefresh={() => void refreshToday()}
      overlay={(
        <TaskSelectionActionsPopup
          visible={selectedTaskIds.length > 1 || selectedGroupIds.length > 0}
          taskCount={selectedTasks.length}
          loading={bulkActionLoading || bulkDateSaving}
          canGroup={canGroupSelectedTasks}
          onComplete={() => void performBulkCompletion(true)}
          onMoveToDate={() => setBulkDateOpen(true)}
          onGroup={() => setGroupComposerOpen(true)}
          onDelete={() => void confirmBulkDelete()}
          onDismiss={clearSelection}
        />
      )}>
      <View style={styles.heroCopy}>
        <AppText variant="display">{greeting()}{name ? `, ${name}` : ''}.</AppText>
        <AppText color="muted">{formatLongDate()}</AppText>
      </View>

      {resource.loading && <LoadingView label="Gathering your day…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {resource.data && (
        <>
          <Card style={styles.overview}>
            <View style={styles.spaceBetween}>
              <View>
                <AppText variant="heading">Today</AppText>
                <AppText color="muted">{remaining ? `${remaining} left · ${completed} done` : todayTasks.length ? 'Everything is done' : 'A clear day'}</AppText>
              </View>
              <View style={[styles.progressCircle, { borderColor: colors.accentSoft }]}>
                <AppText variant="label" color="accent">{Math.round(progress * 100)}%</AppText>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
            </View>
          </Card>

          <View style={styles.spaceBetween}>
            <AppText variant="heading">Today’s tasks</AppText>
            <View style={styles.taskActions}>
              <AppButton
                compact
                label="Group"
                icon="folder-open-outline"
                variant="secondary"
                disabled={groupableTodayTasks.length < 2}
                onPress={() => setGroupComposerOpen(true)}
              />
              <AppButton compact label="Add" icon="add" onPress={() => setComposerOpen(true)} />
            </View>
          </View>
          <View style={styles.list}>
            {listItems.length ? listItems.map(item => {
              const itemKey = item.kind === 'task' ? taskItemKey(item.task.taskId) : groupItemKey(item.group.groupId);
              return item.kind === 'task' ? (
              <TaskRow
                key={itemKey}
                task={item.task}
                onToggle={() => void toggle(item.task)}
                onPress={() => selectedTaskIds.length || selectedGroupIds.length ? toggleSelection(item.task.taskId) : setSelected(item.task)}
                onLongPress={() => startSelection(item.task.taskId)}
                onSelectionToggle={selectedTaskIds.length || selectedGroupIds.length ? () => toggleSelection(item.task.taskId) : undefined}
                selected={selectedTaskIdSet.has(item.task.taskId) || selectedGroupTaskIdSet.has(item.task.taskId)}
                dragEnabled={!selectionActive}
                dragging={draggedTaskId === item.task.taskId}
                dragInProgress={Boolean(dragSource)}
                dragPreviewOffset={dragPreviewOffsets.get(itemKey) ?? 0}
                dropTarget={dragTargetItemKey === taskItemKey(item.task.taskId)}
                dropTargetEdge={dragTargetItemKey === taskItemKey(item.task.taskId) ? dragTargetEdge ?? undefined : undefined}
                onDragLayout={registerTaskLayout}
                onDragViewRef={registerTaskView}
                onDragStart={startTaskDrag}
                onDragMove={updateDragTarget}
                onDragEnd={finishDrag}
                onDragCancel={resetDrag}
              />
              ) : (
              <DraggableTaskGroup
                key={itemKey}
                groupId={item.group.groupId}
                enabled={!selectionActive}
                dragging={draggedGroupId === item.group.groupId}
                dragInProgress={Boolean(dragSource)}
                dragPreviewOffset={dragPreviewOffsets.get(itemKey) ?? 0}
                onViewRef={(_groupId, node) => {
                  if (node) groupRefs.current.set(item.group.groupId, node);
                  else groupRefs.current.delete(item.group.groupId);
                }}
                onLayout={() => registerGroupLayout(item.group.groupId)}
                onDragStart={startGroupDrag}
                onDragMove={updateDragTarget}
                onDragEnd={finishDrag}
                onDragCancel={resetDrag}
                style={[
                  styles.group,
                  {
                    borderWidth: selectedGroupIdSet.has(item.group.groupId) || dragTargetGroupId === item.group.groupId ? 2 : 1,
                    borderColor: selectedGroupIdSet.has(item.group.groupId) || dragTargetGroupId === item.group.groupId ? colors.accent : colors.border,
                    backgroundColor: dragTargetGroupId === item.group.groupId ? colors.accentSoft : colors.surface,
                    overflow: dragSource ? 'visible' : 'hidden',
                  },
                ]}
                header={(
                  <SilentPressable
                    accessibilityRole="button"
                    accessibilityLabel={`${collapsedGroupIds.has(item.group.groupId) ? 'Expand' : 'Collapse'} ${item.group.name}`}
                    accessibilityState={{ expanded: !collapsedGroupIds.has(item.group.groupId) }}
                    onPress={event => { event.stopPropagation(); toggleGroup(item.group.groupId); }}
                    style={({ pressed }) => [
                      styles.groupHeader,
                      collapsedGroupIds.has(item.group.groupId) ? styles.groupHeaderCollapsed : styles.groupHeaderExpanded,
                      { backgroundColor: selectedGroupIdSet.has(item.group.groupId) || dragTargetGroupId === item.group.groupId ? colors.accentSoft : colors.surface, borderBottomColor: colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <GroupChevron
                      collapsed={collapsedGroupIds.has(item.group.groupId)}
                      color={selectedGroupIdSet.has(item.group.groupId) || dragTargetGroupId === item.group.groupId ? colors.accent : colors.textMuted}
                    />
                    <View style={styles.groupSelection}>
                      <AppText variant="label" style={styles.groupTitle}>{item.group.name}</AppText>
                      <AppText variant="caption" color="muted">{item.tasks.length}</AppText>
                    </View>
                    <SilentPressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add task to ${item.group.name}`}
                      hitSlop={8}
                      onPress={event => { event.stopPropagation(); setGroupTaskComposer(item.group); }}
                      style={({ pressed }) => [styles.groupSelect, pressed && styles.pressed]}>
                      <Ionicons name="add-circle-outline" size={22} color={selectedGroupIdSet.has(item.group.groupId) ? colors.accent : colors.textMuted} />
                    </SilentPressable>
                    <SilentPressable
                      accessibilityRole="button"
                      accessibilityLabel={`${selectedGroupIdSet.has(item.group.groupId) ? 'Deselect' : 'Select'} ${item.group.name}`}
                      accessibilityState={{ selected: selectedGroupIdSet.has(item.group.groupId) }}
                      hitSlop={8}
                      onPress={event => { event.stopPropagation(); toggleGroupSelection(item.group.groupId); }}
                      style={({ pressed }) => [styles.groupSelect, pressed && styles.pressed]}>
                      <Ionicons
                        name={selectedGroupIdSet.has(item.group.groupId) ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={selectedGroupIdSet.has(item.group.groupId) ? colors.accent : colors.textMuted}
                      />
                    </SilentPressable>
                  </SilentPressable>
                )}
              >
                {!collapsedGroupIds.has(item.group.groupId) && (
                  <View
                    style={[
                      styles.groupTasks,
                      { backgroundColor: colors.surface },
                    ]}>
                    {item.tasks.map(task => (
                        <TaskRow
                        key={task.taskId}
                        task={task}
                        onToggle={() => void toggle(task)}
                        onPress={() => selectedTaskIds.length || selectedGroupIds.length ? toggleSelection(task.taskId) : setSelected(task)}
                        onLongPress={() => startSelection(task.taskId)}
                        onSelectionToggle={selectedTaskIds.length || selectedGroupIds.length ? () => toggleSelection(task.taskId) : undefined}
                        selected={selectedTaskIdSet.has(task.taskId) || selectedGroupTaskIdSet.has(task.taskId)}
                        dragEnabled={!selectionActive}
                        dragging={draggedTaskId === task.taskId}
                        dragInProgress={Boolean(dragSource)}
                        dragPreviewOffset={dragPreviewOffsets.get(taskItemKey(task.taskId)) ?? 0}
                        dropTarget={dragTargetItemKey === taskItemKey(task.taskId)}
                        dropTargetEdge={dragTargetItemKey === taskItemKey(task.taskId) ? dragTargetEdge ?? undefined : undefined}
                        onDragLayout={registerTaskLayout}
                        onDragViewRef={registerTaskView}
                        onDragStart={startTaskDrag}
                        onDragMove={updateDragTarget}
                        onDragEnd={finishDrag}
                        onDragCancel={resetDrag}
                        inGroup
                        groupLast={task.taskId === item.tasks[item.tasks.length - 1]?.taskId}
                        />
                    ))}
                  </View>
                )}
                {dragTargetItemKey === groupItemKey(item.group.groupId) && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.groupDropIndicator,
                      dragTargetEdge === 'after' ? styles.groupDropIndicatorAfter : styles.groupDropIndicatorBefore,
                      { backgroundColor: colors.accent, shadowColor: colors.accent },
                    ]}
                  />
                )}
              </DraggableTaskGroup>
              );
            }) : (
              <Card style={styles.emptyCard}>
                <AppText variant="heading">Nothing scheduled</AppText>
                <AppText color="muted">Leave the space open, or add one small next action.</AppText>
              </Card>
            )}
          </View>
        </>
      )}
      <TaskComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={addTask}
      />
      <TaskComposerSheet
        key={`group-task-${groupTaskComposer?.groupId ?? 'closed'}`}
        visible={Boolean(groupTaskComposer)}
        onClose={() => setGroupTaskComposer(null)}
        onCreated={task => addTaskToGroup(task)}
      />
      <TaskGroupComposerSheet
        visible={groupComposerOpen}
        taskIds={selectedTaskActionIds}
        availableTasks={groupableTodayTasks}
        onClose={() => setGroupComposerOpen(false)}
        onCreated={clearSelection}
      />
      <TaskBulkDateSheet
        key={`${bulkDateOpen}-${selectedTasks[0]?.scheduledPerformDateTime ?? ''}`}
        visible={bulkDateOpen}
        taskCount={selectedTasks.length}
        initialValue={selectedTasks[0]?.scheduledPerformDateTime ?? null}
        saving={bulkDateSaving}
        onClose={() => setBulkDateOpen(false)}
        onApply={value => void moveSelectedToDate(value)}
      />
      <TaskDetailSheet
        key={selected?.taskId ?? 'no-task'}
        task={selected}
        onClose={() => setSelected(null)}
        onUpdated={updateTask}
        onDeleted={removeTask}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCopy: { gap: 5, paddingTop: 4 },
  overview: { gap: 18 },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  list: { gap: TASK_LIST_GAP },
  group: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  groupHeader: { minHeight: 64, borderTopLeftRadius: 19, borderTopRightRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  groupHeaderCollapsed: { borderBottomLeftRadius: 19, borderBottomRightRadius: 19 },
  groupHeaderExpanded: { borderBottomWidth: StyleSheet.hairlineWidth },
  groupSelection: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { flex: 1 },
  groupSelect: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  groupTasks: { paddingVertical: 0 },
  groupDropIndicator: { position: 'absolute', left: 12, right: 12, height: 3, borderRadius: 2, zIndex: 22, elevation: 4, shadowOpacity: 0.5, shadowRadius: 4 },
  groupDropIndicatorBefore: { top: -6.5 },
  groupDropIndicatorAfter: { bottom: -6.5 },
  pressed: { opacity: 0.7 },
  emptyCard: { alignItems: 'center', gap: 6 },
});
