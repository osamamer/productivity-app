import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { TaskBulkDateSheet } from '@/components/tasks/TaskBulkDateSheet';
import { TaskGroupComposerSheet } from '@/components/tasks/TaskGroupComposerSheet';
import { TaskSelectionActionsPopup } from '@/components/tasks/TaskSelectionActionsPopup';
import { TaskRow, type TaskDragLayout } from '@/components/tasks/TaskRow';
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

const TASK_DROP_ZONE_RADIUS = 18;

type TaskListItem =
  | { kind: 'task'; task: Task }
  | { kind: 'group'; group: TaskGroup; tasks: Task[] };

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
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null);
  const [dragTargetEdge, setDragTargetEdge] = useState<'before' | 'after' | null>(null);
  const [dragTargetGroupId, setDragTargetGroupId] = useState<string | null>(null);
  const taskLayoutsRef = useRef(new Map<string, TaskDragLayout>());
  const taskRowRefs = useRef(new Map<string, View>());
  const groupLayoutsRef = useRef(new Map<string, Pick<TaskDragLayout, 'top' | 'bottom'>>());
  const draggedTaskRef = useRef<string | null>(null);
  const groupRefs = useRef(new Map<string, View>());
  const dragTargetRef = useRef<{ taskId: string | null; edge: 'before' | 'after' | null; groupId: string | null }>({ taskId: null, edge: null, groupId: null });

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
    draggedTaskRef.current = null;
    setDraggedTaskId(null);
    setDragTargetTaskId(null);
    setDragTargetEdge(null);
    setDragTargetGroupId(null);
    dragTargetRef.current = { taskId: null, edge: null, groupId: null };
  }

  function startDrag(taskId: string, _startY: number) {
    taskLayoutsRef.current.clear();
    groupLayoutsRef.current.clear();
    taskRowRefs.current.forEach((view, visibleTaskId) => {
      view.measureInWindow((left, top, width, height) => {
        taskLayoutsRef.current.set(visibleTaskId, { left, top, width, bottom: top + height });
      });
    });
    groupRefs.current.forEach((view, groupId) => {
      view.measureInWindow((_left, top, _width, height) => {
        groupLayoutsRef.current.set(groupId, { top, bottom: top + height });
      });
    });
    clearSelection();
    setSelected(null);
    draggedTaskRef.current = taskId;
    setDraggedTaskId(taskId);
    setDragTargetTaskId(null);
    setDragTargetEdge(null);
    setDragTargetGroupId(null);
    dragTargetRef.current = { taskId: null, edge: null, groupId: null };
  }

  function updateDragTarget(taskId: string, moveY: number, _dy: number) {
    if (draggedTaskRef.current !== taskId) return;
    const groupTarget = [...groupLayoutsRef.current.entries()].find(([groupId, layout]) => {
      const group = groups.find(candidate => candidate.groupId === groupId);
      return !group?.taskIds.includes(taskId) && moveY >= layout.top && moveY <= layout.bottom;
    });
    if (groupTarget) {
      const next = { taskId: null, edge: null, groupId: groupTarget[0] } as const;
      dragTargetRef.current = next;
      setDragTargetTaskId(next.taskId);
      setDragTargetEdge(next.edge);
      setDragTargetGroupId(next.groupId);
      return;
    }

    const taskTarget = [...taskLayoutsRef.current.entries()]
      .filter(([candidateTaskId]) => candidateTaskId !== draggedTaskRef.current)
      .flatMap(([candidateTaskId, layout]) => ([
        { taskId: candidateTaskId, edge: 'before' as const, distance: Math.abs(moveY - layout.top) },
        { taskId: candidateTaskId, edge: 'after' as const, distance: Math.abs(moveY - layout.bottom) },
      ]))
      .filter(target => target.distance <= TASK_DROP_ZONE_RADIUS)
      .sort((first, second) => first.distance - second.distance)[0];
    if (!taskTarget) {
      dragTargetRef.current = { taskId: null, edge: null, groupId: null };
      setDragTargetTaskId(null);
      setDragTargetEdge(null);
      setDragTargetGroupId(null);
      return;
    }

    dragTargetRef.current = { taskId: taskTarget.taskId, edge: taskTarget.edge, groupId: null };
    setDragTargetTaskId(taskTarget.taskId);
    setDragTargetEdge(taskTarget.edge);
    setDragTargetGroupId(null);
  }

  async function finishDrag(taskId: string, _moveY: number) {
    const target = dragTargetRef.current;
    resetDrag();
    if (target.groupId) {
      const group = groups.find(candidate => candidate.groupId === target.groupId);
      if (group && !group.taskIds.includes(taskId)) {
        try {
          animateLayout();
          await replaceGroupTasks(group.groupId, [...group.taskIds, taskId]);
        } catch (cause) {
          void showError('Could not add task to group', reportError('Could not add task to group', cause));
        }
      }
      return;
    }

    if (!target.taskId || !target.edge || target.taskId === taskId) return;
    const rootTaskIds = allTasks.filter(task => !task.parentId).map(task => task.taskId);
    const fromIndex = rootTaskIds.indexOf(taskId);
    const targetIndex = rootTaskIds.indexOf(target.taskId);
    if (fromIndex < 0 || targetIndex < 0) return;
    rootTaskIds.splice(fromIndex, 1);
    const insertionIndex = rootTaskIds.indexOf(target.taskId) + (target.edge === 'after' ? 1 : 0);
    rootTaskIds.splice(insertionIndex, 0, taskId);
    try {
      animateLayout();
      await reorderTasks(rootTaskIds);
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
  const tasks = todayTasks.filter(task => showCompletedTasks || !task.completed);
  const listItems = useMemo(() => buildTaskListItems(tasks, groups), [groups, tasks]);
  const completed = todayTasks.filter(task => task.completed).length;
  const remaining = todayTasks.length - completed;
  const progress = todayTasks.length ? completed / todayTasks.length : 0;

  async function refreshToday() {
    await Promise.all([resource.reload(), refreshTasks()]);
  }

  return (
    <Screen
      refreshing={resource.refreshing || tasksLoading}
      refreshEnabled={draggedTaskId === null}
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
            <AppButton compact label="Add" icon="add" onPress={() => setComposerOpen(true)} />
          </View>
          <View style={styles.list}>
            {listItems.length ? listItems.map(item => item.kind === 'task' ? (
              <TaskRow
                key={item.task.taskId}
                task={item.task}
                onToggle={() => void toggle(item.task)}
                onPress={() => selectedTaskIds.length || selectedGroupIds.length ? toggleSelection(item.task.taskId) : setSelected(item.task)}
                onLongPress={() => startSelection(item.task.taskId)}
                onSelectionToggle={selectedTaskIds.length || selectedGroupIds.length ? () => toggleSelection(item.task.taskId) : undefined}
                selected={selectedTaskIdSet.has(item.task.taskId) || selectedGroupTaskIdSet.has(item.task.taskId)}
                dragEnabled
                dragging={draggedTaskId === item.task.taskId}
                dropTarget={dragTargetTaskId === item.task.taskId}
                dropTargetEdge={dragTargetTaskId === item.task.taskId ? dragTargetEdge ?? undefined : undefined}
                onDragLayout={registerTaskLayout}
                onDragViewRef={registerTaskView}
                onDragStart={startDrag}
                onDragMove={updateDragTarget}
                onDragEnd={finishDrag}
                onDragCancel={resetDrag}
              />
            ) : (
              <View
                key={item.group.groupId}
                ref={node => {
                  if (node) groupRefs.current.set(item.group.groupId, node);
                  else groupRefs.current.delete(item.group.groupId);
                }}
                onLayout={() => registerGroupLayout(item.group.groupId)}
                style={[
                  styles.group,
                  {
                    borderWidth: selectedGroupIdSet.has(item.group.groupId) || dragTargetGroupId === item.group.groupId ? 2 : 1,
                    borderColor: selectedGroupIdSet.has(item.group.groupId) || dragTargetGroupId === item.group.groupId ? colors.accent : colors.border,
                    backgroundColor: dragTargetGroupId === item.group.groupId ? colors.accentSoft : colors.surface,
                    overflow: draggedTaskId ? 'visible' : 'hidden',
                  },
                ]}
              >
                <View>
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
                </View>
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
                        dragEnabled
                        dragging={draggedTaskId === task.taskId}
                        dropTarget={dragTargetTaskId === task.taskId}
                        dropTargetEdge={dragTargetTaskId === task.taskId ? dragTargetEdge ?? undefined : undefined}
                        onDragLayout={registerTaskLayout}
                        onDragViewRef={registerTaskView}
                        onDragStart={startDrag}
                        onDragMove={updateDragTarget}
                        onDragEnd={finishDrag}
                        onDragCancel={resetDrag}
                        inGroup
                        groupLast={task.taskId === item.tasks[item.tasks.length - 1]?.taskId}
                      />
                    ))}
                  </View>
                )}
              </View>
            )) : (
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
  progressCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  list: { gap: 10 },
  group: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  groupHeader: { minHeight: 64, borderTopLeftRadius: 19, borderTopRightRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  groupHeaderCollapsed: { borderBottomLeftRadius: 19, borderBottomRightRadius: 19 },
  groupHeaderExpanded: { borderBottomWidth: StyleSheet.hairlineWidth },
  groupSelection: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { flex: 1 },
  groupSelect: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  groupTasks: { paddingVertical: 0 },
  pressed: { opacity: 0.7 },
  emptyCard: { alignItems: 'center', gap: 6 },
});
