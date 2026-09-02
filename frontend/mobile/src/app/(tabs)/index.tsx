import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

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
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Day, Task } from '@/types/models';

interface TodayData { day: Day; tasks: Task[] }

export default function TodayScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const resource = useAsyncData<TodayData>(async () => {
    const [day, tasks] = await Promise.all([api.day.today(), api.tasks.today()]);
    return { day, tasks };
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  function updateTask(updated: Task) {
    resource.setData(current => current
      ? { ...current, tasks: current.tasks.map(task => task.taskId === updated.taskId ? updated : task) }
      : current);
  }

  function removeTask(taskId: string) {
    resource.setData(current => current
      ? { ...current, tasks: current.tasks.filter(task => task.taskId !== taskId) }
      : current);
  }

  async function toggle(task: Task) {
    const optimistic = { ...task, completed: !task.completed };
    updateTask(optimistic);
    try {
      updateTask(await api.tasks.update(task.taskId, { completed: optimistic.completed }));
    } catch (cause) {
      updateTask(task);
      Alert.alert('Could not update task', reportError('Could not update task', cause));
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
      Alert.alert('Could not save rating', reportError('Could not save rating', cause));
    } finally {
      setRatingSaving(false);
    }
  }

  const name = user?.firstName || user?.username;
  const tasks = resource.data?.tasks ?? [];
  const completed = tasks.filter(task => task.completed).length;
  const remaining = tasks.length - completed;
  const progress = tasks.length ? completed / tasks.length : 0;

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
                <AppText color="muted">{remaining ? `${remaining} left · ${completed} done` : tasks.length ? 'Everything is done' : 'A clear day'}</AppText>
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
            {tasks.length ? tasks.map(task => (
              <TaskRow
                key={task.taskId}
                task={task}
                onToggle={() => void toggle(task)}
                onPress={() => setSelected(task)}
              />
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
        onCreated={task => resource.setData(current => current ? { ...current, tasks: [task, ...current.tasks] } : current)}
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
  emptyCard: { alignItems: 'center', gap: 6 },
});
