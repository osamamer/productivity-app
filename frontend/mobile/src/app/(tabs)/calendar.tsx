import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CalendarComposerSheet, CalendarManagementContent } from '@/components/calendar/CalendarControls';
import { CalendarDisplayButton, CalendarManagementButton, MonthCalendar } from '@/components/calendar/MonthCalendar';
import { AppButton } from '@/components/ui/AppButton';
import { AppPopup } from '@/components/ui/AppPopup';
import { ErrorView } from '@/components/ui/StateView';
import { Screen } from '@/components/ui/Screen';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { api } from '@/services/api';
import type { Calendar, CalendarEvent, Task } from '@/types/models';

export default function CalendarScreen() {
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false);
  const [calendarManagerOpen, setCalendarManagerOpen] = useState(false);
  const [calendarComposerOpen, setCalendarComposerOpen] = useState(false);
  const [calendarComposerSession, setCalendarComposerSession] = useState(0);
  const [calendarBeingEdited, setCalendarBeingEdited] = useState<Calendar | null>(null);
  const eventsResource = useAsyncData(() => api.events.all());
  const calendarsResource = useAsyncData(() => api.calendars.all());
  const definitionsResource = useAsyncData(() => api.stats.definitions());
  const visibilityRequestIds = useRef(new Map<string, number>());
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
    await Promise.all([eventsResource.reload(), calendarsResource.reload(), definitionsResource.reload(), refreshTasks()]);
  }, [calendarsResource, definitionsResource, eventsResource, refreshTasks]);

  async function updateCalendarVisibility(calendar: Calendar, visible: boolean) {
    const current = calendarsResource.data ?? [];
    const requestId = (visibilityRequestIds.current.get(calendar.id) ?? 0) + 1;
    visibilityRequestIds.current.set(calendar.id, requestId);
    calendarsResource.setData(current.map(item => item.id === calendar.id ? { ...item, visible } : item));
    try {
      const updated = await api.calendars.update(calendar.id, { visible });
      if (visibilityRequestIds.current.get(calendar.id) === requestId) {
        calendarsResource.setData(previous => (previous ?? []).map(item => item.id === calendar.id ? updated : item));
      }
    } catch (cause) {
      if (visibilityRequestIds.current.get(calendar.id) === requestId) {
        calendarsResource.setData(previous => (previous ?? []).map(item => item.id === calendar.id ? calendar : item));
      }
      throw cause;
    }
  }

  async function createCalendar(input: Parameters<typeof api.calendars.create>[0]) {
    const created = await api.calendars.create(input);
    calendarsResource.setData(previous => [...(previous ?? []), created].sort((a, b) => a.displayOrder - b.displayOrder));
    return created;
  }

  async function updateCalendar(calendar: Calendar, input: Parameters<typeof api.calendars.update>[1]) {
    const updated = await api.calendars.update(calendar.id, input);
    calendarsResource.setData(previous => (previous ?? []).map(item => item.id === calendar.id ? updated : item).sort((a, b) => a.displayOrder - b.displayOrder));
  }

  async function deleteCalendar(calendar: Calendar) {
    await api.calendars.remove(calendar.id);
    calendarsResource.setData(previous => (previous ?? []).filter(item => item.id !== calendar.id));
  }

  function openCalendarComposer(calendar: Calendar | null) {
    setCalendarBeingEdited(calendar);
    setCalendarComposerSession(session => session + 1);
    setCalendarManagerOpen(false);
    setTimeout(() => setCalendarComposerOpen(true), 350);
  }

  async function saveCalendar(input: Parameters<typeof api.calendars.create>[0]) {
    if (calendarBeingEdited) await updateCalendar(calendarBeingEdited, input);
    else await createCalendar(input);
    setCalendarComposerOpen(false);
  }

  function saveEvent(event: CalendarEvent) {
    const current = eventsResource.data ?? [];
    const next = current.some(item => item.id === event.id)
      ? current.map(item => item.id === event.id ? event : item)
      : [...current, event];
    eventsResource.setData(next);
  }

  async function deleteEvent(eventId: string) {
    await api.events.remove(eventId);
    const next = (eventsResource.data ?? []).filter(event => event.id !== eventId);
    eventsResource.setData(next);
  }

  async function cancelEventOccurrence(eventId: string, occurrenceKey: string) {
    const updated = await api.events.cancelOccurrence(eventId, occurrenceKey);
    saveEvent(updated);
    return updated;
  }

  async function restoreEventOccurrence(eventId: string, occurrenceKey: string) {
    const updated = await api.events.restoreOccurrence(eventId, occurrenceKey);
    saveEvent(updated);
    return updated;
  }

  async function updateEventOccurrenceStatus(eventId: string, occurrenceKey: string, status: CalendarEvent['status']) {
    const updated = await api.events.updateOccurrenceStatus(eventId, occurrenceKey, status);
    saveEvent(updated);
    return updated;
  }

  async function deleteEventOccurrence(eventId: string, occurrenceKey: string) {
    const updated = await api.events.deleteOccurrence(eventId, occurrenceKey);
    saveEvent(updated);
    return updated;
  }

  async function deleteTaskOccurrence(taskId: string) {
    await api.tasks.removeOccurrence(taskId);
    removeTask(taskId);
  }

  function saveTask(task: Task) {
    addTask(task);
  }

  return (
    <Screen
      eyebrow="What’s ahead"
      contentStyle={styles.content}
      refreshing={eventsResource.refreshing || calendarsResource.refreshing || definitionsResource.refreshing}
      onRefresh={() => void refresh()}
      overlay={(
        <View style={calendarStyles.calendarActions}>
          <CalendarDisplayButton
            disabled={eventsResource.loading || calendarsResource.loading || tasksLoading}
            onPress={() => setDisplayOptionsOpen(true)} />
          <CalendarManagementButton
            disabled={calendarsResource.loading}
            onPress={() => setCalendarManagerOpen(true)} />
        </View>
      )}>
      {eventsResource.error && !eventsResource.data && <ErrorView message={eventsResource.error} retry={() => void eventsResource.reload()} />}
      {calendarsResource.error && !calendarsResource.data && <ErrorView message={calendarsResource.error} retry={() => void calendarsResource.reload()} />}
      {tasksError && !allTasks.length && <ErrorView message={tasksError} retry={() => void refreshTasks()} />}
      <MonthCalendar
        tasks={allTasks}
        groups={groups}
        events={eventsResource.data ?? []}
        calendars={calendarsResource.data ?? []}
        statDefinitions={definitionsResource.data ?? []}
        eventsLoading={eventsResource.loading}
        calendarsLoading={calendarsResource.loading}
        tasksLoading={tasksLoading}
        definitionsLoading={definitionsResource.loading}
        onEventSaved={saveEvent}
        onEventOccurrenceCancelled={cancelEventOccurrence}
        onEventOccurrenceRestored={restoreEventOccurrence}
        onEventOccurrenceStatusUpdated={updateEventOccurrenceStatus}
        onEventOccurrenceDeleted={deleteEventOccurrence}
        onEventDeleted={deleteEvent}
        onTaskCreated={saveTask}
        onTaskUpdated={updateTask}
        onTaskDeleted={taskId => {
          removeTask(taskId);
          void refreshTasks();
        }}
        onTaskOccurrenceDeleted={deleteTaskOccurrence}
        displayOptionsOpen={displayOptionsOpen}
        onDisplayOptionsOpenChange={setDisplayOptionsOpen} />
      <AppPopup
        visible={calendarManagerOpen}
        showIcon={false}
        title="Calendars"
        onClose={() => setCalendarManagerOpen(false)}
        footer={<AppButton label="Done" onPress={() => setCalendarManagerOpen(false)} />}>
        <ScrollView style={calendarStyles.calendarManagerScroll} keyboardShouldPersistTaps="handled">
          <CalendarManagementContent
            calendars={calendarsResource.data ?? []}
            loading={calendarsResource.loading}
            onVisibilityChange={updateCalendarVisibility}
            onAdd={() => openCalendarComposer(null)}
            onEdit={calendar => openCalendarComposer(calendar)} />
        </ScrollView>
      </AppPopup>
      <CalendarComposerSheet
        key={`${calendarBeingEdited?.id ?? 'new-calendar'}-${calendarComposerSession}`}
        calendar={calendarBeingEdited}
        visible={calendarComposerOpen}
        onClose={() => setCalendarComposerOpen(false)}
        onSave={saveCalendar}
        onDelete={deleteCalendar} />
    </Screen>
  );
}

const calendarStyles = StyleSheet.create({
  calendarActions: { position: 'absolute', right: 18, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  calendarManagerScroll: { maxHeight: '55%' },
});

const styles = {
  content: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 112,
    gap: 8,
  },
};
