import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { reportError } from '@/lib/errors';
import { api } from '@/services/api';
import type { PomodoroStatus, Task } from '@/types/models';

type Filter = 'today' | 'upcoming' | 'all';

function taskDate(task: Task): string {
  return task.scheduledPerformDateTime?.slice(0, 10) ?? '';
}

export default function TasksScreen() {
  const resource = useAsyncData(() => api.tasks.all());
  const [filter, setFilter] = useState<Filter>('today');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
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
    const tasks = resource.data ?? [];
    if (filter === 'today') return tasks.filter(task => taskDate(task) === localDate());
    if (filter === 'upcoming') return tasks.filter(task => taskDate(task) > localDate());
    return tasks;
  }, [filter, resource.data]);

  const visibleTasks = activePomodoroTaskId
    ? (resource.data ?? []).filter(task => task.taskId === activePomodoroTaskId)
    : filtered;

  function replace(updated: Task) {
    resource.setData(current => current?.map(task => task.taskId === updated.taskId ? updated : task) ?? current);
    setSelected(updated);
  }

  function updateList(updated: Task) {
    resource.setData(current => current?.map(task => task.taskId === updated.taskId ? updated : task) ?? current);
  }

  async function toggle(task: Task) {
    const optimistic = { ...task, completed: !task.completed };
    updateList(optimistic);
    try {
      updateList(await api.tasks.update(task.taskId, { completed: optimistic.completed }));
    } catch (cause) {
      updateList(task);
      Alert.alert('Could not update task', reportError('Could not update task', cause));
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
      {!resource.loading && resource.data && !visibleTasks.length && (
        <EmptyView title="No tasks here" message="Use Add when a clear next action comes to mind." />
      )}
      <View style={styles.list}>
        {visibleTasks.map(task => (
          <TaskRow
            key={task.taskId}
            task={task}
            onToggle={() => void toggle(task)}
            onPress={() => setSelected(task)}
            onPomodoroPress={() => openPomodoro(task.taskId)}
            pomodoroOpen={expandedPomodoroTaskId === task.taskId || activePomodoroTaskId === task.taskId}
            pomodoroStatus={activePomodoroTaskId === task.taskId ? activePomodoroStatus : null}
            onPomodoroActiveChange={active => handlePomodoroActiveChange(task.taskId, active)}
            onPomodoroStatusChange={status => handlePomodoroStatusChange(task.taskId, status)}
            onPomodoroClose={() => setExpandedPomodoroTaskId(null)}
          />
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
        onStartFocus={task => { setSelected(null); openPomodoro(task.taskId); }}
        onDeleted={id => resource.setData(current => current?.filter(task => task.taskId !== id) ?? current)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: 10 } });
