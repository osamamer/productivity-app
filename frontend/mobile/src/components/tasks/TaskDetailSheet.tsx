import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { reportError } from '@/lib/errors';
import { TASK_PRIORITY_OPTIONS, taskPriorityValue } from '@/lib/taskPriority';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Task, TaskRecurrenceFrequency, TaskSeries } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';
import { TaskScheduleField } from './TaskScheduleField';
import { TaskReminderField } from './TaskReminderField';

export function TaskDetailSheet({ task, onClose, onUpdated, onStartFocus, onDeleted, onDeletedOccurrence, onSubtaskCreated }: {
  task: Task | null;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onStartFocus?: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onDeletedOccurrence?: (taskId: string) => Promise<void>;
  onSubtaskCreated?: (task: Task) => void;
}) {
  const { confirm } = useAppPopup();
  const { colors } = useAppTheme();
  const [name, setName] = useState(task?.name ?? '');
  const [scheduledPerformDateTime, setScheduledPerformDateTime] = useState(task?.scheduledPerformDateTime ?? '');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(task?.reminderMinutesBefore ?? null);
  const [importance, setImportance] = useState(taskPriorityValue(task?.importance ?? 0));
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [repeat, setRepeat] = useState<TaskRecurrenceFrequency>('NONE');
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [subtaskComposerOpen, setSubtaskComposerOpen] = useState(false);
  const [subtaskName, setSubtaskName] = useState('');
  const [subtaskSaving, setSubtaskSaving] = useState(false);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const taskNameInputRef = useRef<TextInput>(null);
  const subtaskInputRef = useRef<TextInput>(null);
  const seriesRef = useRef<TaskSeries | null>(null);
  const repeatRef = useRef<TaskRecurrenceFrequency>('NONE');
  const recurrenceMutationRef = useRef<Promise<void>>(Promise.resolve());
  const recurrenceRequestIdRef = useRef(0);

  useEffect(() => {
    if (!task?.taskId) return undefined;
    const focusTimer = setTimeout(() => taskNameInputRef.current?.focus(), 220);
    return () => clearTimeout(focusTimer);
  }, [task?.taskId]);

  useEffect(() => {
    const taskId = task?.taskId;
    const parentId = task?.parentId;
    let active = true;
    const resetTimer = setTimeout(() => {
      setSubtasks([]);
      setSubtaskComposerOpen(false);
      setSubtaskName('');
      setSubtaskError(null);
      if (!taskId || parentId) return;

      setSubtasksLoading(true);
      void api.tasks.subtasks(taskId)
        .then(items => {
          if (active) setSubtasks(items);
        })
        .catch(cause => {
          if (active) setSubtaskError(reportError('Could not load subtasks', cause));
        })
        .finally(() => {
          if (active) setSubtasksLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(resetTimer);
    };
  }, [task?.parentId, task?.taskId]);

  useEffect(() => {
    if (!subtaskComposerOpen) return undefined;
    const focusTimer = setTimeout(() => subtaskInputRef.current?.focus(), 220);
    return () => clearTimeout(focusTimer);
  }, [subtaskComposerOpen]);

  useEffect(() => {
    const taskId = task?.taskId;
    const taskSeriesId = task?.taskSeriesId;
    let cancelled = false;
    if (!taskSeriesId || !taskId) return () => { cancelled = true; };

    api.tasks.recurrence(taskId)
      .then(nextSeries => {
        if (cancelled || !nextSeries) return;
        seriesRef.current = nextSeries;
        const nextRepeat = nextSeries.active ? nextSeries.recurrenceFrequency : 'NONE';
        repeatRef.current = nextRepeat;
        setRepeat(nextRepeat);
      })
      .catch(cause => {
        if (!cancelled) setError(reportError('Could not load repeat settings', cause));
      });
    return () => { cancelled = true; };
  }, [task?.taskId, task?.taskSeriesId]);

  async function save() {
    if (!task || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.tasks.update(task.taskId, {
        name: name.trim(),
        scheduledPerformDateTime,
        importance,
        completed,
        reminderMinutesBefore,
      });
      onUpdated(updated);
      onClose();
    } catch (cause) {
      setError(reportError('Could not save task', cause));
    } finally {
      setSaving(false);
    }
  }

  async function submitSubtask() {
    if (!task || task.parentId || subtaskSaving) return;
    const trimmedName = subtaskName.trim();
    if (!trimmedName) {
      setSubtaskError('Give the subtask a name.');
      return;
    }

    setSubtaskSaving(true);
    setSubtaskError(null);
    try {
      const created = await api.tasks.createSubtask(task.taskId, {
        name: trimmedName,
        description: '',
        scheduledPerformDateTime: task.scheduledPerformDateTime ?? '',
        tag: task.tag ?? '',
        importance: task.importance,
        reminderMinutesBefore: null,
      });
      setSubtasks(previous => [...previous, created]);
      onSubtaskCreated?.(created);
      setSubtaskName('');
      setTimeout(() => subtaskInputRef.current?.focus(), 0);
    } catch (cause) {
      setSubtaskError(reportError('Could not add subtask', cause));
    } finally {
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

  async function confirmDelete(scope: 'occurrence' | 'series') {
    if (!task) return;
    setDeletePromptOpen(false);
    const deletingOccurrence = scope === 'occurrence';
    const title = deletingOccurrence ? 'Delete this occurrence?' : task.taskSeriesId ? 'Delete task series?' : 'Delete task?';
    const message = deletingOccurrence
      ? `${task.name} will be removed from this date.`
      : task.taskSeriesId
        ? `${task.name} and all occurrences in its series will be removed.`
        : task.name;
    if (!await confirm(title, message, 'Delete')) return;
    setDeleting(true);
    try {
      if (deletingOccurrence) {
        await onDeletedOccurrence!(task.taskId);
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
      title="Task details"
      footer={<AppButton label="Save changes" loading={saving} onPress={() => void save()} />}>
      <AppInput ref={taskNameInputRef} label="Task" value={name} onChangeText={setName} autoFocus />
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
              onPress={() => void toggleSubtask(subtask)}
              style={({ pressed }) => [styles.subtaskRow, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
              <Ionicons name={subtask.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={subtask.completed ? colors.success : colors.textMuted} />
              <AppText variant="label" numberOfLines={2} style={[styles.subtaskName, subtask.completed && styles.completed]}>{subtask.name}</AppText>
            </SilentPressable>
          ))}
          {subtaskComposerOpen ? (
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
          ) : (
            <AppButton compact variant="ghost" label="Add subtask" icon="add" onPress={() => setSubtaskComposerOpen(true)} style={styles.addSubtaskButton} />
          )}
          {subtaskError && <AppText variant="caption" color="danger">{subtaskError}</AppText>}
        </View>
      )}
      <SilentPressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        onPress={() => setCompleted(value => !value)}
        style={({ pressed }) => [styles.completeToggle, { borderColor: colors.border, backgroundColor: completed ? colors.accentSoft : colors.background }, pressed && styles.pressed]}>
        <Ionicons name={completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={completed ? colors.success : colors.textMuted} />
        <AppText variant="label">{completed ? 'Completed' : 'Mark as complete'}</AppText>
      </SilentPressable>
      <TaskScheduleField
        value={scheduledPerformDateTime}
        onChange={handleScheduledChange}
        timeOnly={repeat !== 'NONE' && Boolean(scheduledPerformDateTime)}
      />
      {!task?.parentId && (
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
      <TaskReminderField value={reminderMinutesBefore} onChange={setReminderMinutesBefore} />
      <AppText variant="label">Priority</AppText>
      <ChoiceChips value={importance} onChange={setImportance} options={[...TASK_PRIORITY_OPTIONS]} />
      {error && <AppText color="danger">{error}</AppText>}
      <View style={styles.actions}>
        {onStartFocus && task && <AppButton label="Focus options" icon="timer-outline" variant="secondary" onPress={() => { onClose(); onStartFocus(task); }} style={styles.grow} />}
        <AppButton label="Delete" icon="trash-outline" variant="danger" onPress={requestDelete} disabled={deleting} style={styles.grow} />
      </View>
      <AppPopup
        visible={deletePromptOpen}
        showIcon={false}
        title="Delete recurring task?"
        message="Choose whether to remove just this occurrence or the whole series."
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
  completeToggle: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  subtasks: { gap: 8 },
  subtasksHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subtaskRow: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  subtaskName: { flex: 1 },
  subtaskComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  subtaskInput: { flex: 1 },
  subtaskButton: { minWidth: 72 },
  addSubtaskButton: { alignSelf: 'flex-start' },
  repeatSection: { gap: 8 },
  completed: { textDecorationLine: 'line-through', opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
