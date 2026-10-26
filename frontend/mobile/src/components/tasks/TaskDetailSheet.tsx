import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { reportError } from '@/lib/errors';
import { getCachedTaskDetails } from '@/lib/taskDetailsCache';
import { TASK_PRIORITY_OPTIONS, taskPriorityColor, taskPriorityValue } from '@/lib/taskPriority';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Calendar, Task, TaskRecurrenceFrequency, TaskSeries } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';
import { TaskScheduleField } from './TaskScheduleField';
import { TaskReminderField } from './TaskReminderField';
import { CalendarDestinationField } from '../calendar/CalendarControls';

export function TaskDetailSheet({ task, onClose, onUpdated, onDeleted, onDeletedOccurrence, onDeletedFutureOccurrences, onSubtaskCreated, availableCalendars }: {
  task: Task | null;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onDeletedOccurrence?: (taskId: string) => Promise<void>;
  onDeletedFutureOccurrences?: (taskId: string) => Promise<void>;
  onSubtaskCreated?: (task: Task) => void;
  availableCalendars?: Calendar[];
}) {
  const { confirm } = useAppPopup();
  const { colors } = useAppTheme();
  const linkedTask = Boolean(task?.mentalThreadId);
  const [name, setName] = useState(task?.name ?? '');
  const [scheduledPerformDateTime, setScheduledPerformDateTime] = useState(task?.scheduledPerformDateTime ?? '');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(task?.reminderMinutesBefore ?? null);
  const [importance, setImportance] = useState(taskPriorityValue(task?.importance ?? 0));
  const [priorityScopeOpen, setPriorityScopeOpen] = useState(false);
  const [priorityScope, setPriorityScope] = useState<'occurrence' | 'series' | null>(null);
  const [pendingImportance, setPendingImportance] = useState<number | null>(null);
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [calendarId, setCalendarId] = useState(task?.calendarId ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [repeat, setRepeat] = useState<TaskRecurrenceFrequency>('NONE');
  const [subtasks, setSubtasks] = useState<Task[]>(() => task && !task.parentId
    ? getCachedTaskDetails(task.taskId)?.subtasks ?? []
    : []);
  const [subtasksLoading, setSubtasksLoading] = useState(() => Boolean(
    task && !task.parentId && !getCachedTaskDetails(task.taskId),
  ));
  const [subtaskComposerOpen, setSubtaskComposerOpen] = useState(false);
  const [subtaskName, setSubtaskName] = useState('');
  const [subtaskSaving, setSubtaskSaving] = useState(false);
  const [pendingSubtaskId, setPendingSubtaskId] = useState<string | null>(null);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const taskNameInputRef = useRef<TextInput>(null);
  const subtaskInputRef = useRef<TextInput>(null);
  const pendingSubtaskIdRef = useRef<string | null>(null);
  const seriesRef = useRef<TaskSeries | null>(null);
  const repeatRef = useRef<TaskRecurrenceFrequency>('NONE');
  const recurrenceMutationRef = useRef<Promise<void>>(Promise.resolve());
  const recurrenceRequestIdRef = useRef(0);
  const [previousTaskId, setPreviousTaskId] = useState(task?.taskId);

  if (previousTaskId !== task?.taskId) {
    setPreviousTaskId(task?.taskId);
    const cached = task && !task.parentId ? getCachedTaskDetails(task.taskId) : undefined;
    setSubtasks(cached?.subtasks ?? []);
    setSubtasksLoading(Boolean(task && !task.parentId && !cached));
    setSubtaskComposerOpen(false);
    setSubtaskName('');
    setSubtaskError(null);
  }

  useEffect(() => {
    if (!task?.taskId) return undefined;
    const focusTimer = setTimeout(() => taskNameInputRef.current?.focus(), 220);
    return () => clearTimeout(focusTimer);
  }, [task?.taskId]);

  useEffect(() => {
    const taskId = task?.taskId;
    const parentId = task?.parentId;
    let active = true;
    if (!taskId || parentId || !task) return () => { active = false; };

    void api.tasks.details(task)
      .then(details => {
        if (active) {
          setSubtasks(previous => {
            const pending = previous.filter(subtask => subtask.taskId === pendingSubtaskIdRef.current);
            return [...details.subtasks, ...pending];
          });
        }
      })
      .catch(cause => {
        if (active) setSubtaskError(reportError('Could not load subtasks', cause));
      })
      .finally(() => {
        if (active) setSubtasksLoading(false);
      });
    return () => {
      active = false;
    };
  }, [task]);

  useEffect(() => {
    if (!subtaskComposerOpen) return undefined;
    const focusTimer = setTimeout(() => subtaskInputRef.current?.focus(), 220);
    return () => clearTimeout(focusTimer);
  }, [subtaskComposerOpen]);

  useEffect(() => {
    const taskId = task?.taskId;
    const taskSeriesId = task?.taskSeriesId;
    let cancelled = false;
    if (!taskSeriesId || !taskId || !task) return () => { cancelled = true; };

    const applySeries = (nextSeries: TaskSeries | null) => {
      if (!nextSeries) return;
      seriesRef.current = nextSeries;
      const nextRepeat = nextSeries.active ? nextSeries.recurrenceFrequency : 'NONE';
      repeatRef.current = nextRepeat;
      setRepeat(nextRepeat);
    };
    const cached = getCachedTaskDetails(taskId);
    if (cached) applySeries(cached.taskSeries);

    api.tasks.details(task)
      .then(details => {
        if (cancelled) return;
        const nextSeries = details.taskSeries;
        if (!nextSeries) return;
        seriesRef.current = nextSeries;
        applySeries(nextSeries);
      })
      .catch(cause => {
        if (!cancelled) setError(reportError('Could not load repeat settings', cause));
      });
    return () => { cancelled = true; };
  }, [task]);

  async function save() {
    if (!task || !name.trim()) return;
    const updatePriorityForSeries = priorityScope === 'series' && Boolean(task.taskSeriesId);
    setSaving(true);
    setError(null);
    try {
      const updated = await api.tasks.update(task.taskId, {
        name: name.trim(),
        scheduledPerformDateTime: linkedTask ? task.scheduledPerformDateTime : scheduledPerformDateTime,
        importance: updatePriorityForSeries ? task.importance : importance,
        completed,
        reminderMinutesBefore,
        ...(availableCalendars?.length && calendarId ? { calendarId } : {}),
      });
      if (updatePriorityForSeries && task.taskSeriesId) {
        await api.tasks.updateRecurrenceImportance(task.taskSeriesId, importance);
        onUpdated({ ...updated, importance });
      } else {
        onUpdated(updated);
      }
      onClose();
    } catch (cause) {
      setError(reportError('Could not save task', cause));
    } finally {
      setSaving(false);
    }
  }

  function handlePriorityChange(nextImportance: number) {
    if (!task?.taskSeriesId) {
      setImportance(nextImportance);
      setPriorityScope('occurrence');
      return;
    }
    setPendingImportance(nextImportance);
    setPriorityScopeOpen(true);
  }

  function choosePriorityScope(scope: 'occurrence' | 'series') {
    if (pendingImportance === null) return;
    setImportance(pendingImportance);
    setPendingImportance(null);
    setPriorityScope(scope);
    setPriorityScopeOpen(false);
  }

  async function submitSubtask() {
    if (!task || task.parentId || linkedTask || subtaskSaving) return;
    const trimmedName = subtaskName.trim();
    if (!trimmedName) {
      setSubtaskError('Give the subtask a name.');
      return;
    }

    const optimisticId = `optimistic-subtask-${Date.now()}`;
    const now = new Date();
    const optimisticSubtask: Task = {
      taskId: optimisticId,
      calendarId: task.calendarId,
      name: trimmedName,
      description: '',
      completed: false,
      creationDateTime: now.toISOString(),
      creationDate: now.toISOString().slice(0, 10),
      scheduledPerformDateTime: task.scheduledPerformDateTime ?? '',
      reminderMinutesBefore: null,
      completionDateTime: '',
      parentId: task.taskId,
      tag: task.tag ?? '',
      importance: task.importance,
      displayOrder: subtasks.length,
      mentalThreadId: task.mentalThreadId ?? null,
      taskSeriesId: null,
      seriesOccurrenceAt: null,
      skipped: false,
    };

    setSubtaskSaving(true);
    pendingSubtaskIdRef.current = optimisticId;
    setPendingSubtaskId(optimisticId);
    setSubtaskError(null);
    setSubtasks(previous => [...previous, optimisticSubtask]);
    try {
      const created = await api.tasks.createSubtask(task.taskId, {
        name: trimmedName,
        description: '',
        scheduledPerformDateTime: task.scheduledPerformDateTime ?? '',
        tag: task.tag ?? '',
        importance: task.importance,
        reminderMinutesBefore: null,
      });
      setSubtasks(previous => previous.map(subtask => subtask.taskId === optimisticId ? created : subtask));
      onSubtaskCreated?.(created);
      setSubtaskName('');
      setTimeout(() => subtaskInputRef.current?.focus(), 0);
    } catch (cause) {
      setSubtasks(previous => previous.filter(subtask => subtask.taskId !== optimisticId));
      setSubtaskError(reportError('Could not add subtask', cause));
    } finally {
      pendingSubtaskIdRef.current = null;
      setPendingSubtaskId(null);
      setSubtaskSaving(false);
    }
  }

  async function toggleSubtask(subtask: Task) {
    const completed = !subtask.completed;
    setSubtasks(previous => previous.map(item => item.taskId === subtask.taskId ? { ...item, completed } : item));
    try {
      const updated = await api.tasks.update(subtask.taskId, { completed });
      setSubtasks(previous => previous.map(item => item.taskId === updated.taskId ? updated : item));
    } catch (cause) {
      setSubtasks(previous => previous.map(item => item.taskId === subtask.taskId ? subtask : item));
      setSubtaskError(reportError('Could not update subtask', cause));
    }
  }

  async function confirmDelete(scope: 'occurrence' | 'future' | 'series') {
    if (!task || linkedTask) return;
    setDeletePromptOpen(false);
    const deletingOccurrence = scope === 'occurrence';
    const title = deletingOccurrence
      ? 'Delete this occurrence?'
      : scope === 'future' ? 'Delete future occurrences?' : task.taskSeriesId ? 'Delete task series?' : 'Delete task?';
    const message = deletingOccurrence
      ? `${task.name} will be removed from this date.`
      : scope === 'future'
        ? `Later occurrences of ${task.name} will be removed. This occurrence will remain.`
        : task.taskSeriesId
        ? `${task.name} and all occurrences in its series will be removed.`
        : task.name;
    if (!await confirm(title, message, 'Delete')) return;
    setDeleting(true);
    try {
      if (deletingOccurrence) {
        await onDeletedOccurrence!(task.taskId);
      } else if (scope === 'future') {
        await onDeletedFutureOccurrences!(task.taskId);
      } else {
        await api.tasks.remove(task.taskId);
        onDeleted(task.taskId);
      }
      onClose();
    } catch (cause) {
      setError(reportError('Could not delete task', cause));
    } finally {
      setDeleting(false);
    }
  }

  function requestDelete() {
    if (linkedTask) return;
    if (task?.taskSeriesId && onDeletedOccurrence) {
      setDeletePromptOpen(true);
      return;
    }
    void confirmDelete('series');
  }

  function changeRepeat(nextRepeat: TaskRecurrenceFrequency, scheduleOverride = scheduledPerformDateTime) {
    if (!task || task.parentId) return;
    const previousRepeat = repeatRef.current;
    const previousSeries = seriesRef.current;
    const requestId = recurrenceRequestIdRef.current + 1;
    recurrenceRequestIdRef.current = requestId;
    repeatRef.current = nextRepeat;
    setRepeat(nextRepeat);
    setError(null);

    recurrenceMutationRef.current = recurrenceMutationRef.current
      .catch(() => undefined)
      .then(async () => {
        if (requestId !== recurrenceRequestIdRef.current) return;
        const currentSeries = seriesRef.current;
        if (nextRepeat === 'NONE') {
          if (!currentSeries?.active) return;
          await api.tasks.stopRecurrence(currentSeries.seriesId);
          if (requestId !== recurrenceRequestIdRef.current) return;
          const stoppedSeries = { ...currentSeries, active: false };
          seriesRef.current = stoppedSeries;
          onUpdated({ ...task, taskSeriesId: stoppedSeries.seriesId });
          return;
        }

        if (!scheduleOverride) return;
        const recurrence = {
          recurrenceFrequency: nextRepeat,
          recurrenceEndDate: null,
          recurrenceInterval: null,
          recurrenceUnit: null,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        } as const;
        const nextSeries = currentSeries
          ? await api.tasks.updateRecurrence(currentSeries.seriesId, { ...recurrence, active: true })
          : await api.tasks.startRecurrence(task.taskId, recurrence);
        if (requestId !== recurrenceRequestIdRef.current) return;
        seriesRef.current = nextSeries;
        onUpdated({ ...task, taskSeriesId: nextSeries.seriesId });
      })
      .catch(cause => {
        if (requestId !== recurrenceRequestIdRef.current) return;
        repeatRef.current = previousRepeat;
        seriesRef.current = previousSeries;
        setRepeat(previousRepeat);
        setError(reportError('Could not update repeat settings', cause));
      });
  }

  function handleScheduledChange(nextScheduledPerformDateTime: string) {
    setScheduledPerformDateTime(nextScheduledPerformDateTime);
    if (nextScheduledPerformDateTime && repeatRef.current !== 'NONE' && !seriesRef.current) {
      changeRepeat(repeatRef.current, nextScheduledPerformDateTime);
    }
  }

  return (
    <ModalSheet
      visible={Boolean(task)}
      onClose={onClose}
      footer={<AppButton label="Save changes" loading={saving} onPress={() => void save()} />}>
      <View style={styles.taskNameRow}>
        <SilentPressable
          accessibilityRole="checkbox"
          accessibilityLabel={completed ? 'Mark task as incomplete' : 'Mark task as complete'}
          accessibilityState={{ checked: completed }}
          onPress={() => setCompleted(value => !value)}
          style={({ pressed }) => [styles.completeToggle, pressed && styles.pressed]}>
          <Ionicons
            name={completed ? 'checkbox' : 'square-outline'}
            size={23}
            color={taskPriorityColor(importance)} />
        </SilentPressable>
        <AppInput
          ref={taskNameInputRef}
          containerStyle={styles.taskNameInput}
          value={name}
          onChangeText={setName}
          style={[styles.taskTitleInput, completed && styles.completed]}
          accessibilityLabel="Task name"
          autoFocus />
      </View>
      {availableCalendars && <CalendarDestinationField calendars={availableCalendars} value={calendarId} onChange={setCalendarId} />}
      {!task?.parentId && (
        <View style={styles.subtasks}>
          <View style={styles.subtasksHeading}>
            <AppText variant="label">Subtasks</AppText>
            {subtasks.length > 0 && <AppText variant="caption" color="muted">{subtasks.filter(item => item.completed).length}/{subtasks.length} done</AppText>}
          </View>
          {subtasksLoading && <AppText variant="caption" color="muted">Loading subtasks…</AppText>}
          {subtasks.map(subtask => (
            <SilentPressable
              key={subtask.taskId}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: subtask.completed }}
              onPress={() => {
                if (subtask.taskId !== pendingSubtaskId) void toggleSubtask(subtask);
              }}
              style={({ pressed }) => [styles.subtaskRow, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
              <Ionicons name={subtask.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={subtask.completed ? colors.success : colors.textMuted} />
              <AppText variant="label" numberOfLines={2} style={[styles.subtaskName, subtask.completed && styles.completed]}>{subtask.name}</AppText>
            </SilentPressable>
          ))}
          {!linkedTask && subtaskComposerOpen ? (
            <View style={styles.subtaskComposer}>
              <AppInput
                ref={subtaskInputRef}
                containerStyle={styles.subtaskInput}
                label="New subtask"
                value={subtaskName}
                onChangeText={value => { setSubtaskName(value); setSubtaskError(null); }}
                onSubmitEditing={() => void submitSubtask()}
                returnKeyType="done"
              />
              <AppButton compact label="Add" icon="add" loading={subtaskSaving} onPress={() => void submitSubtask()} style={styles.subtaskButton} />
            </View>
          ) : !linkedTask && (
            <AppButton compact variant="ghost" label="Add subtask" icon="add" onPress={() => setSubtaskComposerOpen(true)} style={styles.addSubtaskButton} />
          )}
          {subtaskError && <AppText variant="caption" color="danger">{subtaskError}</AppText>}
        </View>
      )}
      <TaskScheduleField
        value={scheduledPerformDateTime}
        onChange={handleScheduledChange}
        disabled={linkedTask}
      />
      {!task?.parentId && !linkedTask && (
        <View style={styles.repeatSection}>
          <AppText variant="label">Repeat</AppText>
          <ChoiceChips value={repeat} onChange={changeRepeat} options={[
            { value: 'NONE' as const, label: 'Never' },
            { value: 'DAILY' as const, label: 'Daily' },
            { value: 'WEEKLY' as const, label: 'Weekly' },
            { value: 'MONTHLY' as const, label: 'Monthly' },
          ]} />
        </View>
      )}
      <TaskReminderField
        value={reminderMinutesBefore}
        scheduledDateTime={scheduledPerformDateTime}
        onChange={setReminderMinutesBefore}
      />
      <AppText variant="label">Priority</AppText>
          <ChoiceChips value={importance} onChange={handlePriorityChange} options={[...TASK_PRIORITY_OPTIONS]} fillSelected />
      {error && <AppText color="danger">{error}</AppText>}
      <View style={styles.actions}>
        {!linkedTask && <AppButton label="Delete" icon="trash-outline" variant="danger" onPress={requestDelete} disabled={deleting} style={styles.grow} />}
      </View>
      <AppPopup
        visible={priorityScopeOpen}
        showIcon={false}
        title="Change priority?"
        message="Choose whether to change this occurrence or every occurrence in its series."
        onClose={() => {
          setPriorityScopeOpen(false);
          setPendingImportance(null);
        }}
        dismissOnBackdrop={false}
        footer={(
          <View style={styles.deleteChoices}>
            <AppButton
              style={styles.deleteChoice}
              label="This occurrence"
              variant="secondary"
              onPress={() => choosePriorityScope('occurrence')} />
            <AppButton
              style={styles.deleteChoice}
              label="All occurrences"
              variant="secondary"
              onPress={() => choosePriorityScope('series')} />
          </View>
        )} />
      <AppPopup
        visible={deletePromptOpen}
        showIcon={false}
        title="Delete recurring task?"
        message="Choose which occurrences to remove."
        onClose={() => setDeletePromptOpen(false)}
        dismissOnBackdrop={false}
        footer={(
          <View style={styles.deleteChoices}>
            <AppButton
              style={styles.deleteChoice}
              label="This occurrence"
              variant="secondary"
              disabled={deleting}
              onPress={() => void confirmDelete('occurrence')} />
            <AppButton
              style={styles.deleteChoice}
              label="Future occurrences"
              variant="secondary"
              disabled={deleting || !onDeletedFutureOccurrences}
              onPress={() => void confirmDelete('future')} />
            <AppButton
              style={styles.deleteChoice}
              label="All occurrences"
              variant="danger"
              disabled={deleting}
              onPress={() => void confirmDelete('series')} />
          </View>
        )} />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  deleteChoices: { gap: 10 },
  deleteChoice: { width: '100%' },
  taskNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskNameInput: { flex: 1, minWidth: 0 },
  taskTitleInput: { minHeight: 0, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', fontSize: 22, fontWeight: '600', lineHeight: 28 },
  completeToggle: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },
  subtasks: { gap: 8 },
  subtasksHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subtaskRow: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  subtaskName: { flex: 1 },
  subtaskComposer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  subtaskInput: { flex: 1, minWidth: 0 },
  subtaskButton: { minWidth: 72, minHeight: 48, marginTop: 22 },
  addSubtaskButton: { alignSelf: 'flex-start' },
  repeatSection: { gap: 8 },
  completed: { textDecorationLine: 'line-through', opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
