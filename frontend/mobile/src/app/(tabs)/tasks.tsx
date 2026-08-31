import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { TaskRow } from '@/components/tasks/TaskRow';
import { AppButton } from '@/components/ui/AppButton';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/StateView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { localDate } from '@/lib/date';
import { api } from '@/services/api';
import type { Task } from '@/types/models';

type Filter = 'today' | 'upcoming' | 'all';

function taskDate(task: Task): string {
  return task.scheduledPerformDateTime?.slice(0, 10) ?? '';
}

export default function TasksScreen() {
  const resource = useAsyncData(() => api.tasks.all());
  const [filter, setFilter] = useState<Filter>('today');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    const tasks = resource.data ?? [];
    if (filter === 'today') return tasks.filter(task => taskDate(task) === localDate());
    if (filter === 'upcoming') return tasks.filter(task => taskDate(task) > localDate());
    return tasks;
  }, [filter, resource.data]);

  function replace(updated: Task) {
    resource.setData(current => current?.map(task => task.taskId === updated.taskId ? updated : task) ?? current);
    setSelected(updated);
  }

  async function toggle(task: Task) {
    const optimistic = { ...task, completed: !task.completed };
    replace(optimistic);
    try {
      replace(await api.tasks.update(task.taskId, { completed: optimistic.completed }));
      setSelected(null);
    } catch (cause) {
      replace(task);
      Alert.alert('Could not update task', cause instanceof Error ? cause.message : undefined);
    }
  }

  return (
    <Screen
      title="Tasks"
      eyebrow="Make it manageable"
      action={<AppButton compact label="Add" icon="add" onPress={() => setComposerOpen(true)} />}
      refreshing={resource.refreshing}
      onRefresh={() => void resource.reload()}>
      <ChoiceChips value={filter} onChange={setFilter} options={[
        { value: 'today', label: 'Today' },
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'all', label: 'All' },
      ]} />
      {resource.loading && <LoadingView label="Loading tasks…" />}
      {resource.error && !resource.data && <ErrorView message={resource.error} retry={() => void resource.reload()} />}
      {!resource.loading && resource.data && !filtered.length && (
        <EmptyView title="No tasks here" message="Use Add when a clear next action comes to mind." />
      )}
      <View style={styles.list}>
        {filtered.map(task => (
          <TaskRow key={task.taskId} task={task} onToggle={() => void toggle(task)} onPress={() => setSelected(task)} />
        ))}
      </View>
      <TaskComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={task => resource.setData(current => current ? [task, ...current] : [task])}
      />
      <TaskDetailSheet
        key={selected?.taskId ?? 'no-task'}
        task={selected}
        onClose={() => setSelected(null)}
        onUpdated={replace}
        onDeleted={id => resource.setData(current => current?.filter(task => task.taskId !== id) ?? current)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: 10 } });
