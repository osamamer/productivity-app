import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { CalendarDayActionSheet, type CalendarCreateTab } from '@/components/calendar/CalendarDayActionSheet';
import { CalendarStatCheckInSheet } from '@/components/calendar/CalendarStatCheckInSheet';
import { CalendarTaskGroupSheet } from '@/components/calendar/CalendarTaskGroupSheet';
import { EventComposerSheet } from '@/components/calendar/EventComposerSheet';
import { MonthCalendarGrid, type CalendarGridItem } from '@/components/calendar/MonthCalendarGrid';
import { TaskComposerSheet } from '@/components/tasks/TaskComposerSheet';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { formatCalendarTime, localDate } from '@/lib/date';
import { formatDurationValue } from '@/lib/statValues';
import { datesCoveredByOccurrence, expandCalendarEvent } from '@/lib/calendarRecurrence';
import { reportError } from '@/lib/errors';
import { taskPriorityColor } from '@/lib/taskPriority';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { CalendarEvent, StatDefinition, StatEntry, Task, TaskGroup } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { SilentPressable } from '../ui/SilentPressable';

type TaskStatusFilter = 'all' | 'open' | 'completed';

interface CalendarDisplayPreferences {
  showTasks: boolean;
  showStats: boolean;
  taskStatus: TaskStatusFilter;
  priorityFilters: number[];
  selectedStatIds: string[] | null;
}

const DISPLAY_PREFERENCES_KEY = 'mobile.calendar-display-preferences';
const PRIORITY_OPTIONS = [
  { label: 'Low', value: 3, color: '#1976d2' },
  { label: 'Medium', value: 6, color: '#eab308' },
  { label: 'High', value: 9, color: '#ef4444' },
] as const;
const DEFAULT_DISPLAY_PREFERENCES: CalendarDisplayPreferences = {
  showTasks: true,
  showStats: true,
  taskStatus: 'all',
  priorityFilters: [3, 6, 9],
  selectedStatIds: null,
};

function monthStart(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth(), 1);
}

function calendarRange(month: Date): { start: Date; end: Date } {
  const first = monthStart(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 42);
  return { start, end };
}

function priorityBucket(importance: number): number {
  if (importance > 7) return 9;
  if (importance > 4) return 6;
  return 3;
}

function statValue(definition: StatDefinition, value: number): string {
  if (definition.type === 'BOOLEAN') return value === 1 ? 'Yes' : 'No';
  if (definition.type === 'DURATION') return formatDurationValue(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function statColor(definition: StatDefinition, value: number, colors: ReturnType<typeof useAppTheme>['colors']): string {
  if (definition.type !== 'BOOLEAN') return colors.secondary;
  const morality = definition.morality ?? 'NEUTRAL';
  if (morality === 'NEUTRAL') return value === 1 ? colors.accent : colors.secondary;
  if (morality === 'GOOD') return value === 1 ? colors.success : colors.danger;
  return value === 1 ? colors.danger : colors.success;
}

function readPreferences(value: string | null): CalendarDisplayPreferences {
  if (!value) return DEFAULT_DISPLAY_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<CalendarDisplayPreferences>;
    return {
      showTasks: typeof parsed.showTasks === 'boolean' ? parsed.showTasks : DEFAULT_DISPLAY_PREFERENCES.showTasks,
      showStats: typeof parsed.showStats === 'boolean' ? parsed.showStats : DEFAULT_DISPLAY_PREFERENCES.showStats,
      taskStatus: parsed.taskStatus === 'open' || parsed.taskStatus === 'completed' ? parsed.taskStatus : DEFAULT_DISPLAY_PREFERENCES.taskStatus,
      priorityFilters: Array.isArray(parsed.priorityFilters)
        ? parsed.priorityFilters.filter(item => PRIORITY_OPTIONS.some(option => option.value === item))
        : DEFAULT_DISPLAY_PREFERENCES.priorityFilters,
      selectedStatIds: Array.isArray(parsed.selectedStatIds)
        ? parsed.selectedStatIds.filter((item): item is string => typeof item === 'string')
        : null,
    };
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

function addCalendarItem(items: Map<string, CalendarGridItem[]>, item: CalendarGridItem) {
  const current = items.get(item.date) ?? [];
  current.push(item);
  items.set(item.date, current);
}

export function CalendarDisplayButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <SilentPressable
      accessibilityRole="button"
      accessibilityLabel="Calendar display options"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.floatingDisplayButton,
        { backgroundColor: colors.accent, shadowColor: colors.accent },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Ionicons name="options-outline" size={18} color={colors.onAccent} />
      <AppText variant="label" style={{ color: colors.onAccent }}>Display</AppText>
    </SilentPressable>
  );
}

export function MonthCalendar({
  tasks,
  groups,
  events,
  statDefinitions,
  eventsLoading = false,
  tasksLoading = false,
  definitionsLoading = false,
  onEventSaved,
  onEventDeleted,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  displayOptionsOpen,
  onDisplayOptionsOpenChange,
}: {
  tasks: Task[];
  groups: TaskGroup[];
  events: CalendarEvent[];
  statDefinitions: StatDefinition[];
  eventsLoading?: boolean;
  tasksLoading?: boolean;
  definitionsLoading?: boolean;
  onEventSaved: (event: CalendarEvent) => void;
  onEventDeleted: (eventId: string) => Promise<void>;
  onTaskCreated: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
  displayOptionsOpen: boolean;
  onDisplayOptionsOpenChange: (open: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const { confirm } = useAppPopup();
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [preferences, setPreferences] = useState<CalendarDisplayPreferences>(DEFAULT_DISPLAY_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<CalendarGridItem[]>([]);
  const [dayInitialTab, setDayInitialTab] = useState<CalendarCreateTab>('event');
  const [createTarget, setCreateTarget] = useState<{ date: string; tab: CalendarCreateTab } | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statEntries, setStatEntries] = useState<StatEntry[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statRefreshKey, setStatRefreshKey] = useState(0);
  const range = useMemo(() => calendarRange(month), [month]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(DISPLAY_PREFERENCES_KEY).then(value => {
      if (!active) return;
      setPreferences(readPreferences(value));
      setPreferencesLoaded(true);
    }).catch(cause => {
      console.warn('Could not load calendar display preferences:', cause);
      if (active) setPreferencesLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    void AsyncStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences)).catch(cause => {
      console.warn('Could not save calendar display preferences:', cause);
    });
  }, [preferences, preferencesLoaded]);

  const selectedStatIds = useMemo(
    () => preferences.selectedStatIds ?? statDefinitions.map(definition => definition.id),
    [preferences.selectedStatIds, statDefinitions],
  );
  const selectedStatDefinitions = useMemo(
    () => statDefinitions.filter(definition => selectedStatIds.includes(definition.id)),
    [selectedStatIds, statDefinitions],
  );
  const hasVisibleStats = preferences.showStats && selectedStatDefinitions.length > 0;

  useEffect(() => {
    if (!hasVisibleStats) {
      return;
    }

    let active = true;
    const from = localDate(range.start);
    const lastDay = new Date(range.end);
    lastDay.setDate(lastDay.getDate() - 1);
    const to = localDate(lastDay);
    void Promise.all(selectedStatDefinitions.map(definition => api.stats.entries(definition.id, from, to)))
      .then(entriesByDefinition => {
        if (active) {
          setStatEntries(entriesByDefinition.flat());
          setStatsError(null);
        }
      })
      .catch(cause => {
        if (active) setStatsError(reportError('Could not load calendar statistics', cause));
      });
    return () => { active = false; };
  }, [hasVisibleStats, range.end, range.start, selectedStatDefinitions, statRefreshKey]);

  const calendarTasks = useMemo(() => tasks.filter(task => {
    if (!task.scheduledPerformDateTime) return false;
    if (preferences.taskStatus === 'open' && task.completed) return false;
    if (preferences.taskStatus === 'completed' && !task.completed) return false;
    return preferences.priorityFilters.includes(priorityBucket(task.importance));
  }), [preferences.priorityFilters, preferences.taskStatus, tasks]);

  const taskGroupByTaskId = useMemo(() => {
    const result = new Map<string, TaskGroup>();
    [...groups]
      .sort((first, second) => first.displayOrder - second.displayOrder)
      .forEach(group => group.taskIds.forEach(taskId => {
        if (!result.has(taskId)) result.set(taskId, group);
      }));
    return result;
  }, [groups]);

  const itemsByDate = useMemo(() => {
    const items = new Map<string, CalendarGridItem[]>();
    if (!eventsLoading) {
      events.forEach(event => expandCalendarEvent(event, range.start, range.end).forEach(occurrence => {
        datesCoveredByOccurrence(occurrence).forEach(date => addCalendarItem(items, {
          id: `${occurrence.id}-${date}`,
          sourceId: event.id,
          date,
          title: event.title,
          kind: 'calendarEvent',
          timeLabel: occurrence.allDay ? undefined : formatCalendarTime(occurrence.start, event.timeZone),
          color: colors.accent,
          textColor: colors.onAccent,
        }));
      }));
    }

    if (preferences.showTasks && !tasksLoading) {
      const taskById = new Map(tasks.map(task => [task.taskId, task]));
      const groupDates = new Set<string>();
      calendarTasks.forEach(task => {
        const date = localDate(new Date(task.scheduledPerformDateTime));
        const group = taskGroupByTaskId.get(task.taskId);
        if (group) {
          const groupDateKey = `${group.groupId}-${date}`;
          if (groupDates.has(groupDateKey)) return;
          groupDates.add(groupDateKey);
          addCalendarItem(items, {
            id: groupDateKey,
            sourceId: group.groupId,
            date,
            title: group.name,
            kind: 'taskGroup',
            completed: group.taskIds.length > 0 && group.taskIds.every(taskId => taskById.get(taskId)?.completed === true),
            color: colors.accent,
          });
          return;
        }
        addCalendarItem(items, {
          id: task.taskId,
          sourceId: task.taskId,
          date,
          title: task.name || 'Untitled task',
          kind: 'task',
          completed: task.completed,
          color: taskPriorityColor(task.importance),
        });
      });
    }

    if (hasVisibleStats) {
      const definitionsById = new Map(selectedStatDefinitions.map(definition => [definition.id, definition]));
      statEntries.forEach(entry => {
        const definition = definitionsById.get(entry.statDefinitionId);
        if (!definition) return;
        const color = statColor(definition, entry.value, colors);
        addCalendarItem(items, {
          id: `stat-${entry.statDefinitionId}-${entry.date}`,
          sourceId: entry.statDefinitionId,
          date: entry.date,
          title: `${definition.name}: ${statValue(definition, entry.value)}`,
          kind: 'stat',
          color,
        });
      });
    }

    items.forEach(dayItems => dayItems.sort((first, second) => {
      const order = { calendarEvent: 0, taskGroup: 1, task: 2, stat: 3 };
      return order[first.kind] - order[second.kind] || first.title.localeCompare(second.title);
    }));
    return items;
  }, [calendarTasks, colors, events, eventsLoading, hasVisibleStats, preferences.showTasks, range.end, range.start, selectedStatDefinitions, statEntries, taskGroupByTaskId, tasks, tasksLoading]);

  const selectedGroupTasks = useMemo(() => {
    if (!selectedGroup) return [];
    const filteredTaskIds = new Set(calendarTasks.map(task => task.taskId));
    return selectedGroup.taskIds
      .map(taskId => tasks.find(task => task.taskId === taskId))
      .filter((task): task is Task => task !== undefined && filteredTaskIds.has(task.taskId));
  }, [calendarTasks, selectedGroup, tasks]);

  const closeDay = useCallback(() => setDayDate(null), []);

  const openCreate = useCallback((tab: CalendarCreateTab) => {
    if (!dayDate) return;
    const date = dayDate;
    setDayDate(null);
    setTimeout(() => setCreateTarget({ date, tab }), 220);
  }, [dayDate]);

  const openItem = useCallback((item: CalendarGridItem) => {
    if (item.kind === 'calendarEvent') {
      const event = events.find(candidate => candidate.id === item.sourceId);
      if (event) setEditingEvent(event);
    } else if (item.kind === 'taskGroup') {
      const group = groups.find(candidate => candidate.groupId === item.sourceId);
      if (group) setSelectedGroup(group);
    } else if (item.kind === 'task') {
      const task = tasks.find(candidate => candidate.taskId === item.sourceId);
      if (task) setSelectedTask(task);
    } else {
      setCreateTarget({ date: item.date, tab: 'stats' });
    }
  }, [events, groups, tasks]);

  const handleDayItemPress = useCallback((item: CalendarGridItem) => {
    setDayDate(null);
    setTimeout(() => openItem(item), 220);
  }, [openItem]);

  function openDay(date: string, items: CalendarGridItem[]) {
    setDayItems(items);
    setDayInitialTab('event');
    setDayDate(date);
  }

  function togglePriority(value: number) {
    setPreferences(previous => ({
      ...previous,
      priorityFilters: previous.priorityFilters.includes(value)
        ? previous.priorityFilters.filter(item => item !== value)
        : [...previous.priorityFilters, value],
    }));
  }

  function toggleStat(id: string) {
    setPreferences(previous => {
      const selected = previous.selectedStatIds ?? statDefinitions.map(definition => definition.id);
      return { ...previous, selectedStatIds: selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id] };
    });
  }

  async function deleteEvent(eventId: string): Promise<boolean> {
    if (!await confirm('Delete event?', 'This event will be removed from your calendar.', 'Delete')) return false;
    await onEventDeleted(eventId);
    return true;
  }

  return (
    <>
      {statsError && hasVisibleStats && <AppText variant="caption" color="danger">{statsError}</AppText>}
      <MonthCalendarGrid
        month={month}
        itemsByDate={itemsByDate}
        loading={eventsLoading || tasksLoading || definitionsLoading}
        onMonthChange={offset => setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1))}
        onToday={() => setMonth(monthStart(new Date()))}
        onDayPress={openDay}
        onItemPress={openItem} />

      <AppPopup visible={displayOptionsOpen} showIcon={false} title="Calendar display" onClose={() => onDisplayOptionsOpenChange(false)} footer={<AppButton label="Done" onPress={() => onDisplayOptionsOpenChange(false)} />}>
        <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterContent} showsVerticalScrollIndicator={false}>
          <AppText color="muted">Choose what appears in the month view.</AppText>
          <View style={styles.switchRow}>
            <AppText variant="label">Show tasks</AppText>
            <Switch value={preferences.showTasks} onValueChange={value => setPreferences(previous => ({ ...previous, showTasks: value }))} trackColor={{ false: colors.border, true: colors.accentSoft }} thumbColor={preferences.showTasks ? colors.accent : colors.textMuted} />
          </View>
          <View style={styles.switchRow}>
            <AppText variant="label">Show statistics</AppText>
            <Switch value={preferences.showStats} onValueChange={value => setPreferences(previous => ({ ...previous, showStats: value }))} trackColor={{ false: colors.border, true: colors.accentSoft }} thumbColor={preferences.showStats ? colors.accent : colors.textMuted} />
          </View>

          {preferences.showTasks && (
            <>
              <AppText variant="caption" color="muted">Task status</AppText>
              <ChoiceChips value={preferences.taskStatus} onChange={value => setPreferences(previous => ({ ...previous, taskStatus: value }))} options={[{ value: 'all' as const, label: 'All' }, { value: 'open' as const, label: 'Open' }, { value: 'completed' as const, label: 'Done' }]} />
              <AppText variant="caption" color="muted">Priority levels</AppText>
              <View style={styles.filterChoices}>
                {PRIORITY_OPTIONS.map(option => (
                  <SilentPressable key={option.value} accessibilityRole="checkbox" accessibilityState={{ checked: preferences.priorityFilters.includes(option.value) }} onPress={() => togglePriority(option.value)} style={styles.filterChoice}>
                    <Ionicons name={preferences.priorityFilters.includes(option.value) ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={preferences.priorityFilters.includes(option.value) ? option.color : colors.textMuted} />
                    <AppText variant="label">{option.label}</AppText>
                  </SilentPressable>
                ))}
              </View>
            </>
          )}

          {preferences.showStats && statDefinitions.length > 0 && (
            <>
              <View style={styles.statsHeading}>
                <AppText variant="caption" color="muted">Statistics to show</AppText>
                <View style={styles.smallActions}>
                  <AppButton compact variant="ghost" label="All" onPress={() => setPreferences(previous => ({ ...previous, selectedStatIds: statDefinitions.map(definition => definition.id) }))} />
                  <AppButton compact variant="ghost" label="None" onPress={() => setPreferences(previous => ({ ...previous, selectedStatIds: [] }))} />
                </View>
              </View>
              <View style={styles.statChoices}>
                {statDefinitions.map(definition => {
                  const selected = selectedStatIds.includes(definition.id);
                  return (
                    <SilentPressable key={definition.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleStat(definition.id)} style={styles.filterChoice}>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? colors.accent : colors.textMuted} />
                      <AppText variant="label" numberOfLines={1} style={styles.choiceLabel}>{definition.name}</AppText>
                    </SilentPressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </AppPopup>

      <CalendarDayActionSheet
        key={`${dayDate}-${dayInitialTab}`}
        date={dayDate}
        items={dayItems}
        allowTasks={preferences.showTasks}
        allowStats={hasVisibleStats && dayDate !== null && dayDate <= localDate()}
        initialTab={dayInitialTab}
        onClose={closeDay}
        onCreate={openCreate}
        onItemPress={handleDayItemPress} />

      <EventComposerSheet
        key={`create-event-${createTarget?.date ?? 'closed'}`}
        visible={createTarget?.tab === 'event'}
        initialDate={createTarget?.date}
        onClose={() => setCreateTarget(null)}
        onSaved={event => { onEventSaved(event); setCreateTarget(null); }} />
      <TaskComposerSheet
        key={`create-task-${createTarget?.date ?? 'closed'}`}
        visible={createTarget?.tab === 'task'}
        initialDate={createTarget?.date}
        onClose={() => setCreateTarget(null)}
        onCreated={task => { onTaskCreated(task); setCreateTarget(null); }} />
      <CalendarStatCheckInSheet
        key={`create-stats-${createTarget?.date ?? 'closed'}`}
        date={createTarget?.tab === 'stats' ? createTarget.date : null}
        definitions={selectedStatDefinitions}
        onClose={() => setCreateTarget(null)}
        onSaved={() => setStatRefreshKey(value => value + 1)} />
      <EventComposerSheet
        key={`edit-event-${editingEvent?.id ?? 'closed'}`}
        visible={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSaved={event => { onEventSaved(event); setEditingEvent(null); }}
        onDelete={editingEvent ? () => deleteEvent(editingEvent.id) : undefined} />
      <CalendarTaskGroupSheet
        group={selectedGroup}
        tasks={selectedGroupTasks}
        onClose={() => setSelectedGroup(null)}
        onTaskPress={task => { setSelectedGroup(null); setTimeout(() => setSelectedTask(task), 220); }} />
      <TaskDetailSheet
        key={`task-${selectedTask?.taskId ?? 'closed'}`}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdated={task => { onTaskUpdated(task); setSelectedTask(null); }}
        onDeleted={taskId => { onTaskDeleted(taskId); setSelectedTask(null); }} />
    </>
  );
}

const styles = StyleSheet.create({
  floatingDisplayButton: { position: 'absolute', right: 18, bottom: 24, minHeight: 48, borderRadius: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12, shadowOpacity: 0.28, elevation: 6 },
  filterScroll: { maxHeight: 460 },
  filterContent: { gap: 14, paddingBottom: 2 },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filterChoices: { gap: 2 },
  filterChoice: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceLabel: { flex: 1 },
  statsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  smallActions: { flexDirection: 'row', gap: 4 },
  statChoices: { gap: 2 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.7 },
});
