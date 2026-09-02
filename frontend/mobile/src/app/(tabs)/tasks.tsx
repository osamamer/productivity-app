import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskGroupComposerSheet } from '@/components/tasks/TaskGroupComposerSheet';
import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { TaskRow } from '@/components/tasks/TaskRow';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { reportError } from '@/lib/errors';
import { useAppPopup } from '@/providers/PopupProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { PomodoroStatus, Task, TaskGroup } from '@/types/models';

type Filter = 'today' | 'upcoming' | 'all';

type TaskListItem =
  | { kind: 'task'; task: Task }
  | { kind: 'group'; group: TaskGroup; tasks: Task[] };

function buildTaskListItems(tasks: Task[], groups: TaskGroup[]): TaskListItem[] {
  const visibleTaskIds = new Set(tasks.map(task => task.taskId));
  const groupByTaskId = new Map<string, TaskGroup>();
  [...groups]
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

export default function TasksScreen() {
  const { colors } = useAppTheme();
  const { confirm, showError } = useAppPopup();
  const {
    allTasks,
    todayTasks,
    futureTasks,
    pastTasks,
    groups,
    loading,
    error,
    refresh,
    addTask,
    updateTask: updateWorkspaceTask,
    removeTask: removeWorkspaceTask,
    moveTask,
    moveTasksToToday,
  } = useTaskWorkspace();
  const { showCompletedTasks } = usePreferences();
  const [filter, setFilter] = useState<Filter>('today');
  const [composerOpen, setComposerOpen] = useState(false);
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [expandedPomodoroTaskId, setExpandedPomodoroTaskId] = useState<string | null>(null);
  const [activePomodoroTaskId, setActivePomodoroTaskId] = useState<string | null>(null);
  const [activePomodoroStatus, setActivePomodoroStatus] = useState<PomodoroStatus | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void api.pomodoro.status().then(status => {
      if (!active) return;
      if (!status?.active) {
        setActivePomodoroTaskId(null);
        setActivePomodoroStatus(null);
        setExpandedPomodoroTaskId(null);
        return;
      }
      setActivePomodoroTaskId(status.associatedTaskId);
      setActivePomodoroStatus(status);
      setExpandedPomodoroTaskId(status.associatedTaskId);
    }).catch(cause => console.warn('Could not refresh Pomodoro status:', cause));
    return () => { active = false; };
  }, []));

  const openPomodoro = useCallback((taskId: string) => {
    setExpandedPomodoroTaskId(current => current === taskId ? null : taskId);
  }, []);

  const handlePomodoroActiveChange = useCallback((taskId: string, active: boolean) => {
    if (active) {
      setActivePomodoroTaskId(taskId);
      setExpandedPomodoroTaskId(taskId);
    } else {
      setActivePomodoroTaskId(current => current === taskId ? null : current);
      setActivePomodoroStatus(current => current?.associatedTaskId === taskId ? null : current);
      setExpandedPomodoroTaskId(current => current === taskId ? null : current);
    }
  }, []);

  const handlePomodoroStatusChange = useCallback((taskId: string, status: PomodoroStatus) => {
    if (!status.active) return;
    setActivePomodoroTaskId(taskId);
    setActivePomodoroStatus(status);
  }, []);

  const filtered = useMemo(() => {
    const tasks = filter === 'today' ? todayTasks : filter === 'upcoming' ? futureTasks : allTasks;
    return tasks.filter(task => !task.parentId && (showCompletedTasks || !task.completed));
  }, [allTasks, filter, futureTasks, showCompletedTasks, todayTasks]);

  const visibleTasks = activePomodoroTaskId
    ? allTasks.filter(task => task.taskId === activePomodoroTaskId)
    : filtered;
  const listItems = useMemo(() => buildTaskListItems(visibleTasks, groups), [groups, visibleTasks]);
  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const selectedTasks = useMemo(
    () => allTasks.filter(task => selectedTaskIdSet.has(task.taskId)),
    [allTasks, selectedTaskIdSet],
  );
  const selectedPastTaskIds = selectedTasks
    .filter(task => pastTasks.some(pastTask => pastTask.taskId === task.taskId))
    .map(task => task.taskId);

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
      updateList(await api.tasks.update(task.taskId, { completed: optimistic.completed }));
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
  }

  async function performBulkAction(action: 'complete' | 'reopen' | 'move-to-today') {
    if (bulkActionLoading || selectedTasks.length === 0) return;
    setBulkActionLoading(true);
    try {
      if (action === 'move-to-today') {
        await moveTasksToToday(selectedTaskIds);
      } else {
        const completed = action === 'complete';
        const updated = await Promise.all(selectedTasks.map(task => api.tasks.update(task.taskId, { completed })));
        updated.forEach(updateList);
      }
      clearSelection();
    } catch (cause) {
      void showError('Could not update tasks', reportError('Could not update tasks', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function confirmBulkDelete() {
    if (!selectedTasks.length) return;
    if (!await confirm('Delete selected tasks?', `${selectedTasks.length} tasks will be deleted.`, 'Delete')) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(selectedTasks.map(task => api.tasks.remove(task.taskId)));
      selectedTaskIds.forEach(removeWorkspaceTask);
      clearSelection();
    } catch (cause) {
      void showError('Could not delete tasks', reportError('Could not delete tasks', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroupIds(previous => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function moveSelected(direction: 'up' | 'down') {
    if (selectedTaskIds.length !== 1 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await moveTask(selectedTaskIds[0], direction);
    } catch (cause) {
      void showError('Could not move task', reportError('Could not move task', cause));
    } finally {
      setBulkActionLoading(false);
    }
  }

  function renderTask(task: Task) {
    return (
      <TaskRow
        key={task.taskId}
        task={task}
        onToggle={() => void toggle(task)}
        onPress={() => selectedTaskIds.length ? toggleSelection(task.taskId) : setSelected(task)}
        onLongPress={() => startSelection(task.taskId)}
        onSelectionToggle={selectedTaskIds.length ? () => toggleSelection(task.taskId) : undefined}
        selected={selectedTaskIdSet.has(task.taskId)}
        onPomodoroPress={() => openPomodoro(task.taskId)}
        pomodoroOpen={expandedPomodoroTaskId === task.taskId || activePomodoroTaskId === task.taskId}
        pomodoroStatus={activePomodoroTaskId === task.taskId ? activePomodoroStatus : null}
        onPomodoroActiveChange={active => handlePomodoroActiveChange(task.taskId, active)}
        onPomodoroStatusChange={status => handlePomodoroStatusChange(task.taskId, status)}
        onPomodoroClose={() => setExpandedPomodoroTaskId(null)}
      />
    );
  }

  return (
    <Screen
      title="Tasks"
      eyebrow="Make it manageable"
      action={<AppButton compact label="Add" icon="add" onPress={() => setComposerOpen(true)} />}
      refreshing={loading}
      onRefresh={() => void refresh()}>
      {selectedTaskIds.length > 0 ? (
        <View style={styles.selectionBar}>
          <View style={styles.selectionHeader}>
            <AppButton compact label={`${selectedTaskIds.length} selected`} icon="checkmark-circle-outline" variant="secondary" onPress={clearSelection} />
            <AppText variant="caption" color="muted">Long-press another task to add it</AppText>
          </View>
          <View style={styles.actionRow}>
            <AppButton compact label="Complete" icon="checkmark" disabled={bulkActionLoading} onPress={() => void performBulkAction('complete')} />
            <AppButton compact label="Reopen" icon="refresh-outline" variant="secondary" disabled={bulkActionLoading} onPress={() => void performBulkAction('reopen')} />
            {selectedPastTaskIds.length > 0 && <AppButton compact label="Today" icon="today-outline" variant="secondary" disabled={bulkActionLoading} onPress={() => void performBulkAction('move-to-today')} />}
            {selectedTaskIds.length === 1 && (
              <>
                <AppButton compact label="Up" icon="arrow-up" variant="secondary" disabled={bulkActionLoading} onPress={() => void moveSelected('up')} />
                <AppButton compact label="Down" icon="arrow-down" variant="secondary" disabled={bulkActionLoading} onPress={() => void moveSelected('down')} />
              </>
            )}
            {selectedTaskIds.length >= 2 && <AppButton compact label="Group" icon="folder-open-outline" variant="secondary" disabled={bulkActionLoading} onPress={() => setGroupComposerOpen(true)} />}
            <AppButton compact label="Delete" icon="trash-outline" variant="danger" disabled={bulkActionLoading} onPress={confirmBulkDelete} />
          </View>
        </View>
      ) : null}
      <ChoiceChips value={filter} onChange={setFilter} options={[
        { value: 'today', label: 'Today' },
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'all', label: 'All' },
      ]} />
      {loading && <LoadingView label="Loading tasks…" />}
      {error && !allTasks.length && <ErrorView message={error} retry={() => void refresh()} />}
      {!loading && !error && !visibleTasks.length && (
        <EmptyView title="No tasks here" message="Use Add when a clear next action comes to mind." />
      )}
      <View style={styles.list}>
        {listItems.map(item => item.kind === 'task' ? renderTask(item.task) : (
          <View key={item.group.groupId} style={styles.group}>
            <Pressable onPress={() => toggleGroup(item.group.groupId)} style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}>
              <Ionicons name={collapsedGroupIds.has(item.group.groupId) ? 'chevron-forward' : 'chevron-down'} size={18} color={colors.textMuted} />
              <AppText variant="label" style={styles.groupTitle}>{item.group.name}</AppText>
              <AppText variant="caption" color="muted">{item.tasks.length}</AppText>
            </Pressable>
            {!collapsedGroupIds.has(item.group.groupId) && <View style={styles.groupTasks}>{item.tasks.map(renderTask)}</View>}
          </View>
        ))}
      </View>
      <TaskComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={addTask}
      />
      <TaskGroupComposerSheet
        visible={groupComposerOpen}
        taskIds={selectedTaskIds}
        onClose={() => setGroupComposerOpen(false)}
        onCreated={clearSelection}
      />
      <TaskDetailSheet
        key={selected?.taskId ?? 'no-task'}
        task={selected}
        onClose={() => setSelected(null)}
        onUpdated={replace}
        onStartFocus={task => { setSelected(null); openPomodoro(task.taskId); }}
        onDeleted={id => { removeWorkspaceTask(id); setSelected(null); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  selectionBar: { gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#00000008' },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 6 },
  groupHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  groupTitle: { flex: 1 },
  groupTasks: { gap: 10 },
  pressed: { opacity: 0.7 },
});
