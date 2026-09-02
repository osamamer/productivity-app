import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { TaskRow } from '@/components/tasks/TaskRow';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { Screen } from '@/components/ui/Screen';
import { formatLongDate, greeting } from '@/lib/date';
import { reportError } from '@/lib/errors';
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
  const { showError } = useAppPopup();
  const resource = useAsyncData<TodayData>(async () => ({ day: await api.day.today() }));
  const {
    todayTasks,
    groups,
    addTask,
    updateTask: updateTaskInWorkspace,
    removeTask: removeTaskFromWorkspace,
  } = useTaskWorkspace();
  const { showCompletedTasks } = usePreferences();
  const [composerOpen, setComposerOpen] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  function updateTask(updated: Task) {
    updateTaskInWorkspace(updated);
  }

  function removeTask(taskId: string) {
    removeTaskFromWorkspace(taskId);
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroupIds(previous => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function toggle(task: Task) {
    const optimistic = { ...task, completed: !task.completed };
    updateTask(optimistic);
    try {
      updateTask(await api.tasks.update(task.taskId, { completed: optimistic.completed }));
    } catch (cause) {
      updateTask(task);
      void showError('Could not update task', reportError('Could not update task', cause));
    }
  }

  async function saveRating(rating: number) {
    if (!resource.data) return;
    const previous = resource.data.day;
    resource.setData({ ...resource.data, day: { ...previous, rating } });
    setRatingSaving(true);
    try {
      await api.day.save(rating, previous.plan ?? '', previous.summary ?? '');
    } catch (cause) {
      resource.setData(current => current ? { ...current, day: previous } : current);
      void showError('Could not save rating', reportError('Could not save rating', cause));
    } finally {
      setRatingSaving(false);
    }
  }

  const name = user?.firstName || user?.username;
  const tasks = todayTasks.filter(task => showCompletedTasks || !task.completed);
  const listItems = useMemo(() => buildTaskListItems(tasks, groups), [groups, tasks]);
  const completed = todayTasks.filter(task => task.completed).length;
  const remaining = todayTasks.length - completed;
  const progress = todayTasks.length ? completed / todayTasks.length : 0;

  return (
    <Screen refreshing={resource.refreshing} onRefresh={() => void resource.reload()}>
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
            <View style={styles.rating}>
              <AppText variant="caption" color="muted">HOW DOES TODAY FEEL?</AppText>
              <ChoiceChips
                value={Math.round(resource.data.day.rating || 0)}
                onChange={value => void saveRating(value)}
                options={[1, 2, 3, 4, 5].map(value => ({ value, label: String(value) }))}
              />
              {ratingSaving && <AppText variant="caption" color="muted">Saving…</AppText>}
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
                onPress={() => setSelected(item.task)}
              />
            ) : (
              <View key={item.group.groupId} style={[styles.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${collapsedGroupIds.has(item.group.groupId) ? 'Expand' : 'Collapse'} ${item.group.name}`}
                  accessibilityState={{ expanded: !collapsedGroupIds.has(item.group.groupId) }}
                  onPress={() => toggleGroup(item.group.groupId)}
                  style={({ pressed }) => [styles.groupHeader, { backgroundColor: colors.accentSoft, borderBottomColor: colors.border }, pressed && styles.pressed]}>
                  <Ionicons name={collapsedGroupIds.has(item.group.groupId) ? 'chevron-forward' : 'chevron-down'} size={18} color={colors.accent} />
                  <Ionicons name={collapsedGroupIds.has(item.group.groupId) ? 'folder-outline' : 'folder-open-outline'} size={18} color={colors.accent} />
                  <AppText variant="label" style={styles.groupTitle}>{item.group.name}</AppText>
                  <AppText variant="caption" color="muted">{item.tasks.length}</AppText>
                </Pressable>
                {!collapsedGroupIds.has(item.group.groupId) && (
                  <View style={[styles.groupTasks, { backgroundColor: colors.background, borderLeftColor: colors.accent }]}>
                    {item.tasks.map(task => (
                      <TaskRow
                        key={task.taskId}
                        task={task}
                        onToggle={() => void toggle(task)}
                        onPress={() => setSelected(task)}
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
  rating: { gap: 9 },
  list: { gap: 10 },
  group: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  groupHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1 },
  groupTitle: { flex: 1 },
  groupTasks: { gap: 10, marginLeft: 10, paddingLeft: 10, paddingRight: 8, paddingVertical: 10, borderLeftWidth: 2 },
  pressed: { opacity: 0.7 },
  emptyCard: { alignItems: 'center', gap: 6 },
});
