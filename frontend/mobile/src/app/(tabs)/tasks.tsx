import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskGroupComposerSheet } from '@/components/tasks/TaskGroupComposerSheet';
import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskBulkDateSheet } from '@/components/tasks/TaskBulkDateSheet';
import { TaskSelectionActionsPopup } from '@/components/tasks/TaskSelectionActionsPopup';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { TaskRow } from '@/components/tasks/TaskRow';
import { TaskSection } from '@/components/tasks/TaskSection';
import { GroupChevron } from '@/components/tasks/GroupChevron';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { reportError } from '@/lib/errors';
import { playAudioFeedback } from '@/lib/audioFeedback';
import { animateLayout } from '@/lib/motion';
import { useAppPopup } from '@/providers/PopupProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { api, TASK_PAGE_BATCH_SIZE } from '@/services/api';
import {
  DEFAULT_TASK_SECTION_EXPANSION,
  readTaskSectionExpansion,
  saveTaskSectionExpansion,
  type TaskSectionExpansionState,
  type TaskSectionName,
} from '@/lib/taskPagePreferences';
import type { PomodoroStatus, Task, TaskGroup } from '@/types/models';

type Filter = 'today' | 'upcoming' | 'all';

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

function scheduledTime(task: Task): number {
  const time = task.scheduledPerformDateTime ? Date.parse(task.scheduledPerformDateTime) : Number.POSITIVE_INFINITY;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function compareNearestFirst(first: Task, second: Task): number {
  const difference = scheduledTime(first) - scheduledTime(second);
  return difference !== 0 ? difference : first.taskId.localeCompare(second.taskId);
}

function compareMostRecentFirst(first: Task, second: Task): number {
  return compareNearestFirst(second, first);
}

function sectionForTask(task: Task): TaskSectionName {
  if (!task.scheduledPerformDateTime) return 'undated';
  const scheduled = new Date(task.scheduledPerformDateTime);
  if (Number.isNaN(scheduled.getTime())) return 'undated';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scheduledDate = new Date(scheduled.getFullYear(), scheduled.getMonth(), scheduled.getDate());
  if (scheduledDate.getTime() === today.getTime()) return 'today';
  return scheduledDate > today ? 'comingUp' : 'leftovers';
}

export default function TasksScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { confirm, showError } = useAppPopup();
  const {
    allTasks,
    todayTasks,
    futureTasks,
    pastTasks,
    undatedTasks,
    groups,
    loading,
    ready,
    error,
    refresh,
    hasMoreFutureTasks,
    hasMorePastTasks,
    loadMoreFutureTasks,
    loadMorePastTasks,
    addTask,
    updateTask: updateWorkspaceTask,
    removeTask: removeWorkspaceTask,
    moveTask,
    moveTasksToToday,
    moveTasksToDate,
  } = useTaskWorkspace();
  const { showCompletedTasks } = usePreferences();
  const [filter, setFilter] = useState<Filter>('today');
  const [expandedSections, setExpandedSections] = useState<TaskSectionExpansionState>(DEFAULT_TASK_SECTION_EXPANSION);
  const [composerOpen, setComposerOpen] = useState(false);
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [expandedPomodoroTaskId, setExpandedPomodoroTaskId] = useState<string | null>(null);
  const [activePomodoroTaskId, setActivePomodoroTaskId] = useState<string | null>(null);
  const [activePomodoroStatus, setActivePomodoroStatus] = useState<PomodoroStatus | null>(null);
  const activePomodoroStatusRef = useRef<PomodoroStatus | null>(null);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);
  const [bulkDateSaving, setBulkDateSaving] = useState(false);
  const [loadingMoreFutureTasks, setLoadingMoreFutureTasks] = useState(false);
  const [loadingMorePastTasks, setLoadingMorePastTasks] = useState(false);

  useEffect(() => {
    let active = true;
    void readTaskSectionExpansion(user?.id).then(preferences => {
      if (active) setExpandedSections(preferences);
    });
    return () => { active = false; };
  }, [user?.id]);

  const toggleSection = useCallback((section: TaskSectionName) => {
    setExpandedSections(previous => {
      const nextState = { ...previous, [section]: !previous[section] };
      void saveTaskSectionExpansion(user?.id, nextState);
      return nextState;
    });
  }, [user?.id]);

  function changeFilter(nextFilter: Filter) {
    if (nextFilter === filter) return;
    animateLayout();
    setFilter(nextFilter);
  }

  useFocusEffect(useCallback(() => {
    let active = true;
    let requestInFlight = false;

    async function refreshPomodoroStatus() {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      try {
        const status = await api.pomodoro.status();
        if (!active) return;
        if (!status?.active) {
          if (activePomodoroStatusRef.current?.phase === 'COMPLETED') return;
          activePomodoroStatusRef.current = null;
          setActivePomodoroTaskId(null);
          setActivePomodoroStatus(null);
          setExpandedPomodoroTaskId(null);
          return;
        }
        activePomodoroStatusRef.current = status;
        setActivePomodoroTaskId(status.associatedTaskId);
        setActivePomodoroStatus(status);
        setExpandedPomodoroTaskId(status.associatedTaskId);
      } catch (cause) {
        console.warn('Could not refresh Pomodoro status:', cause);
      } finally {
        requestInFlight = false;
      }
    }

    void refreshPomodoroStatus();
    const timer = setInterval(() => void refreshPomodoroStatus(), 5_000);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshPomodoroStatus();
    });

    return () => {
      active = false;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, []));

  const openPomodoro = useCallback((taskId: string) => {
    setExpandedPomodoroTaskId(current => current === taskId ? null : taskId);
  }, []);

  const handlePomodoroActiveChange = useCallback((taskId: string, active: boolean) => {
    if (active) {
      setActivePomodoroTaskId(taskId);
      setExpandedPomodoroTaskId(taskId);
    } else {
      activePomodoroStatusRef.current = null;
      setActivePomodoroTaskId(current => current === taskId ? null : current);
      setActivePomodoroStatus(current => current?.associatedTaskId === taskId ? null : current);
      setExpandedPomodoroTaskId(current => current === taskId ? null : current);
    }
  }, []);

  const handlePomodoroStatusChange = useCallback((taskId: string, status: PomodoroStatus) => {
    if (!status.active && status.phase !== 'COMPLETED') return;
    activePomodoroStatusRef.current = status;
    setActivePomodoroTaskId(taskId);
    setActivePomodoroStatus(status);
  }, []);

  const sectionTasks = useMemo(() => {
    const visible = (tasks: Task[]) => tasks.filter(task => !task.parentId && (showCompletedTasks || !task.completed));
    return {
      today: visible(todayTasks),
      comingUp: visible(futureTasks).sort(compareNearestFirst),
      leftovers: visible(pastTasks).sort(compareMostRecentFirst),
      undated: visible(undatedTasks),
    } satisfies Record<TaskSectionName, Task[]>;
  }, [futureTasks, pastTasks, showCompletedTasks, todayTasks, undatedTasks]);

  const focusedTask = activePomodoroTaskId
    ? allTasks.find(task => task.taskId === activePomodoroTaskId) ?? null
    : null;
  const visibleSectionTasks = useMemo(() => {
    if (!focusedTask) return sectionTasks;
    return {
      today: [],
      comingUp: [],
      leftovers: [],
      undated: [],
      [sectionForTask(focusedTask)]: [focusedTask],
    } satisfies Record<TaskSectionName, Task[]>;
  }, [focusedTask, sectionTasks]);
  const sectionsToRender: TaskSectionName[] = focusedTask
    ? [sectionForTask(focusedTask)]
    : filter === 'today'
      ? ['today']
      : filter === 'upcoming'
        ? ['comingUp']
        : ['today', 'comingUp', 'leftovers', 'undated'];
  const hasRenderableTasks = sectionsToRender.some(section => visibleSectionTasks[section].length > 0)
    || (!focusedTask && ((sectionsToRender.includes('comingUp') && hasMoreFutureTasks)
      || (sectionsToRender.includes('leftovers') && hasMorePastTasks)));
  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedGroupTaskIdSet = useMemo(
    () => new Set(groups.filter(group => selectedGroupIdSet.has(group.groupId)).flatMap(group => group.taskIds)),
    [groups, selectedGroupIdSet],
  );
  const selectedActionTaskIdSet = useMemo(
    () => new Set([...selectedTaskIds, ...selectedGroupTaskIdSet]),
    [selectedGroupTaskIdSet, selectedTaskIds],
  );
  const selectedTasks = useMemo(
    () => allTasks.filter(task => selectedActionTaskIdSet.has(task.taskId)),
    [allTasks, selectedActionTaskIdSet],
  );
  const selectedPastTaskIds = selectedTasks
    .filter(task => pastTasks.some(pastTask => pastTask.taskId === task.taskId))
    .map(task => task.taskId);
  const canGroupSelectedTasks = selectedGroupIds.length === 0 && selectedTaskIds.length >= 2;

  const loadMoreUpcoming = useCallback(async () => {
    if (loadingMoreFutureTasks || !hasMoreFutureTasks) return;
    setLoadingMoreFutureTasks(true);
    try {
      await loadMoreFutureTasks();
    } catch (cause) {
      void showError('Could not load upcoming tasks', reportError('Could not load upcoming tasks', cause));
    } finally {
      setLoadingMoreFutureTasks(false);
    }
  }, [hasMoreFutureTasks, loadMoreFutureTasks, loadingMoreFutureTasks, showError]);

  const loadMoreLeftovers = useCallback(async () => {
    if (loadingMorePastTasks || !hasMorePastTasks) return;
    setLoadingMorePastTasks(true);
    try {
      await loadMorePastTasks();
    } catch (cause) {
      void showError('Could not load older tasks', reportError('Could not load older tasks', cause));
    } finally {
      setLoadingMorePastTasks(false);
    }
  }, [hasMorePastTasks, loadMorePastTasks, loadingMorePastTasks, showError]);

  function replace(updated: Task) {
    updateWorkspaceTask(updated);
    setSelected(updated);
  }

  function updateList(updated: Task) {
    updateWorkspaceTask(updated);
  }

  async function toggle(task: Task) {
    const optimistic = { ...task, completed: !task.completed };
    updateList(optimistic);
    try {
      const updated = await api.tasks.update(task.taskId, { completed: optimistic.completed });
      updateList(updated);
      if (optimistic.completed) playAudioFeedback('taskCompleted');
    } catch (cause) {
      updateList(task);
      void showError('Could not update task', reportError('Could not update task', cause));
    }
  }

  function toggleSelection(taskId: string) {
    setSelectedTaskIds(previous => previous.includes(taskId)
      ? previous.filter(id => id !== taskId)
      : [...previous, taskId]);
  }

  function startSelection(taskId: string) {
    setSelectedTaskIds(previous => previous.includes(taskId) ? previous : [...previous, taskId]);
  }

  function clearSelection() {
    setSelectedTaskIds([]);
    setSelectedGroupIds([]);
    setBulkDateOpen(false);
  }

  function toggleGroupSelection(groupId: string) {
    setSelectedGroupIds(previous => previous.includes(groupId)
      ? previous.filter(id => id !== groupId)
      : [...previous, groupId]);
  }

  async function performBulkAction(action: 'complete' | 'move-to-today') {
    if (bulkActionLoading || selectedTasks.length === 0) return;
    setBulkActionLoading(true);
    try {
      if (action === 'move-to-today') {
        await moveTasksToToday(selectedTasks.map(task => task.taskId));
      } else {
        const tasksToComplete = selectedTasks.filter(task => !task.completed);
        const updated = await Promise.all(selectedTasks.map(task => api.tasks.update(task.taskId, { completed: true })));
        updated.forEach(updateList);
        if (tasksToComplete.length > 0) playAudioFeedback('taskCompleted');
      }
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
      await moveTasksToDate(selectedTasks.map(task => task.taskId), scheduledPerformDateTime);
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
      selectedTasks.forEach(task => removeWorkspaceTask(task.taskId));
      clearSelection();
    } catch (cause) {
      void showError('Could not delete tasks', reportError('Could not delete tasks', cause));
    } finally {
      setBulkActionLoading(false);
    }
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

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupComposerOpen(true);
  }

  function openEditGroup(group: TaskGroup) {
    setEditingGroup(group);
    setGroupComposerOpen(true);
  }

  function closeGroupComposer() {
    setGroupComposerOpen(false);
    setEditingGroup(null);
  }

  async function moveSelected(direction: 'up' | 'down') {
    if (selectedTaskIds.length !== 1 || selectedGroupIds.length > 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await moveTask(selectedTaskIds[0], direction);
    } catch (cause) {
      void showError('Could not move task', reportError('Could not move task', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  function renderListItems(tasks: Task[]) {
    return buildTaskListItems(tasks, groups).map(item => item.kind === 'task' ? renderTask(item.task) : (
      <View
        key={item.group.groupId}
        style={[styles.group, { borderWidth: selectedGroupIdSet.has(item.group.groupId) ? 2 : 1, borderColor: selectedGroupIdSet.has(item.group.groupId) ? colors.accent : colors.border, backgroundColor: colors.surface }]}
      >
        <SilentPressable
          accessibilityRole="button"
          accessibilityLabel={`${collapsedGroupIds.has(item.group.groupId) ? 'Expand' : 'Collapse'} ${item.group.name}`}
          accessibilityState={{ expanded: !collapsedGroupIds.has(item.group.groupId) }}
          onPress={() => toggleGroup(item.group.groupId)}
          style={({ pressed }) => [styles.groupHeader, !collapsedGroupIds.has(item.group.groupId) && styles.groupHeaderExpanded, { backgroundColor: selectedGroupIdSet.has(item.group.groupId) ? colors.accentSoft : colors.surface, borderBottomColor: colors.border }, pressed && styles.pressed]}
        >
          <GroupChevron collapsed={collapsedGroupIds.has(item.group.groupId)} color={colors.accent} />
          <View style={styles.groupSelection}>
            <AppText variant="label" style={styles.groupTitle}>{item.group.name}</AppText>
            <AppText variant="caption" color="muted">{item.tasks.length}</AppText>
          </View>
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.group.name}`}
            hitSlop={8}
            onPress={event => { event.stopPropagation(); openEditGroup(item.group); }}
            style={({ pressed }) => [styles.groupSelect, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
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
        {!collapsedGroupIds.has(item.group.groupId) && (
          <View style={[styles.groupTasks, { backgroundColor: colors.surface }] }>
            {item.tasks.map((task, index) => renderTask(task, true, index === item.tasks.length - 1))}
          </View>
        )}
      </View>
    ));
  }

  function renderTask(task: Task, inGroup = false, groupLast = false) {
    const selectionMode = selectedTaskIds.length > 0 || selectedGroupIds.length > 0;
    return (
      <TaskRow
        key={task.taskId}
        task={task}
        onToggle={() => void toggle(task)}
        onPress={() => selectionMode ? toggleSelection(task.taskId) : setSelected(task)}
        onLongPress={() => startSelection(task.taskId)}
        onSelectionToggle={selectionMode ? () => toggleSelection(task.taskId) : undefined}
        selected={selectedTaskIdSet.has(task.taskId) || selectedGroupTaskIdSet.has(task.taskId)}
        onPomodoroPress={() => openPomodoro(task.taskId)}
        pomodoroOpen={expandedPomodoroTaskId === task.taskId || activePomodoroTaskId === task.taskId}
        pomodoroStatus={activePomodoroTaskId === task.taskId ? activePomodoroStatus : null}
        onPomodoroActiveChange={active => handlePomodoroActiveChange(task.taskId, active)}
        onPomodoroStatusChange={status => handlePomodoroStatusChange(task.taskId, status)}
        onPomodoroClose={() => setExpandedPomodoroTaskId(null)}
        inGroup={inGroup}
        groupLast={groupLast}
      />
    );
  }

  return (
    <Screen
      eyebrow="Make it manageable"
      action={<AppButton compact label="Add" icon="add" onPress={() => setComposerOpen(true)} />}
      overlay={(
        <TaskSelectionActionsPopup
          visible={selectedTaskIds.length > 1 || selectedGroupIds.length > 0}
          taskCount={selectedTasks.length}
          loading={bulkActionLoading || bulkDateSaving}
          canMoveToToday={selectedPastTaskIds.length > 0}
          canReorder={selectedTaskIds.length === 1 && selectedGroupIds.length === 0}
          canGroup={canGroupSelectedTasks}
          onComplete={() => void performBulkAction('complete')}
          onMoveToToday={() => void performBulkAction('move-to-today')}
          onMoveToDate={() => setBulkDateOpen(true)}
          onMoveUp={() => void moveSelected('up')}
          onMoveDown={() => void moveSelected('down')}
          onGroup={openCreateGroup}
          onDelete={() => void confirmBulkDelete()}
          onDismiss={clearSelection}
        />
      )}
      refreshing={loading}
      onRefresh={() => void refresh()}>
      <ChoiceChips value={filter} onChange={changeFilter} options={[
        { value: 'today', label: 'Today' },
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'all', label: 'All' },
      ]} />
      {loading && !ready && <LoadingView label="Loading tasks…" />}
      {error && !allTasks.length && <ErrorView message={error} retry={() => void refresh()} />}
      {ready && !loading && !error && !hasRenderableTasks && (
        <EmptyView title="No tasks here" message="Use Add when a clear next action comes to mind." />
      )}
      <View style={styles.sections}>
        {sectionsToRender.map(section => {
          const tasks = visibleSectionTasks[section];
          const hasMore = section === 'comingUp' ? hasMoreFutureTasks : section === 'leftovers' ? hasMorePastTasks : false;
          if (tasks.length === 0 && !hasMore) return null;
          const title = section === 'today'
            ? 'Today'
            : section === 'comingUp'
              ? 'Coming up'
              : section === 'leftovers'
                ? 'Leftovers'
                : 'No date';
          return (
            <TaskSection
              key={section}
              title={title}
              count={tasks.length}
              completedCount={tasks.filter(task => task.completed).length}
              expanded={expandedSections[section]}
              onToggle={() => toggleSection(section)}
              emptyMessage={section === 'comingUp' ? 'No upcoming tasks loaded yet' : 'No older tasks loaded yet'}
              showMore={hasMore ? {
                label: section === 'comingUp' ? `Show next ${TASK_PAGE_BATCH_SIZE} upcoming tasks` : `Show next ${TASK_PAGE_BATCH_SIZE} older tasks`,
                loading: section === 'comingUp' ? loadingMoreFutureTasks : loadingMorePastTasks,
                onPress: section === 'comingUp' ? () => void loadMoreUpcoming() : () => void loadMoreLeftovers(),
              } : undefined}
            >
              <View style={styles.list}>{renderListItems(tasks)}</View>
            </TaskSection>
          );
        })}
      </View>
      <TaskComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={addTask}
      />
      <TaskGroupComposerSheet
        key={`${editingGroup?.groupId ?? 'new'}-${groupComposerOpen ? 'open' : 'closed'}`}
        visible={groupComposerOpen}
        taskIds={editingGroup?.taskIds ?? selectedTasks.map(task => task.taskId)}
        group={editingGroup}
        availableTasks={editingGroup ? allTasks.filter(task => !task.parentId) : undefined}
        onClose={closeGroupComposer}
        onCreated={() => { clearSelection(); closeGroupComposer(); }}
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
        onUpdated={replace}
        onSubtaskCreated={addTask}
        onStartFocus={task => { setSelected(null); openPomodoro(task.taskId); }}
        onDeleted={id => { removeWorkspaceTask(id); setSelected(null); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 20 },
  list: { gap: 10 },
  group: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  groupHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  groupHeaderExpanded: { borderBottomWidth: StyleSheet.hairlineWidth },
  groupSelection: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { flex: 1 },
  groupSelect: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  groupTasks: { paddingVertical: 0 },
  pressed: { opacity: 0.7 },
});
