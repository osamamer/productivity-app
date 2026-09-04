import { useCallback, useState } from 'react';

import { CalendarDisplayButton, MonthCalendar } from '@/components/calendar/MonthCalendar';
import { ErrorView } from '@/components/ui/StateView';
import { Screen } from '@/components/ui/Screen';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { api } from '@/services/api';
import type { CalendarEvent, Task } from '@/types/models';

export default function CalendarScreen() {
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false);
  const eventsResource = useAsyncData(() => api.events.all());
  const { syncCalendarReminders } = useNotifications();
  const definitionsResource = useAsyncData(() => api.stats.definitions());
  const {
    allTasks,
    groups,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    addTask,
    updateTask,
    removeTask,
  } = useTaskWorkspace();

  const refresh = useCallback(async () => {
    await Promise.all([eventsResource.reload(), definitionsResource.reload(), refreshTasks()]);
  }, [definitionsResource, eventsResource, refreshTasks]);

  function saveEvent(event: CalendarEvent) {
    const current = eventsResource.data ?? [];
    const next = current.some(item => item.id === event.id)
      ? current.map(item => item.id === event.id ? event : item)
      : [...current, event];
    eventsResource.setData(next);
    void syncCalendarReminders(next);
  }

  async function deleteEvent(eventId: string) {
    await api.events.remove(eventId);
    const next = (eventsResource.data ?? []).filter(event => event.id !== eventId);
    eventsResource.setData(next);
    void syncCalendarReminders(next);
  }

  function saveTask(task: Task) {
    addTask(task);
  }

  return (
    <Screen
      eyebrow="What’s ahead"
      contentStyle={styles.content}
      refreshing={eventsResource.refreshing || definitionsResource.refreshing}
      onRefresh={() => void refresh()}
      overlay={(
        <CalendarDisplayButton
          disabled={eventsResource.loading || tasksLoading}
          onPress={() => setDisplayOptionsOpen(true)} />
      )}>
      {eventsResource.error && !eventsResource.data && <ErrorView message={eventsResource.error} retry={() => void eventsResource.reload()} />}
      {tasksError && !allTasks.length && <ErrorView message={tasksError} retry={() => void refreshTasks()} />}
      <MonthCalendar
        tasks={allTasks}
        groups={groups}
        events={eventsResource.data ?? []}
        statDefinitions={definitionsResource.data ?? []}
        eventsLoading={eventsResource.loading}
        tasksLoading={tasksLoading}
        definitionsLoading={definitionsResource.loading}
        onEventSaved={saveEvent}
        onEventDeleted={deleteEvent}
        onTaskCreated={saveTask}
        onTaskUpdated={updateTask}
        onTaskDeleted={removeTask}
        displayOptionsOpen={displayOptionsOpen}
        onDisplayOptionsOpenChange={setDisplayOptionsOpen} />
    </Screen>
  );
}

const styles = {
  content: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 112,
    gap: 8,
  },
};
