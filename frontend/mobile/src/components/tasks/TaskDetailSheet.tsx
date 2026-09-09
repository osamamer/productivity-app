import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

const REMINDER_OPTIONS = [
  { value: -1, label: 'No reminder' },
  { value: 5, label: '5 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
  { value: 10080, label: '1 week before' },
];

export function TaskDetailSheet({ task, onClose, onUpdated, onStartFocus, onDeleted, onDeletedOccurrence }: {
  task: Task | null;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onStartFocus?: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onDeletedOccurrence?: (taskId: string) => Promise<void>;
}) {
  const { confirm } = useAppPopup();
  const { colors } = useAppTheme();
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [scheduledPerformDateTime, setScheduledPerformDateTime] = useState(task?.scheduledPerformDateTime ?? '');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(task?.reminderMinutesBefore ?? null);
  const [importance, setImportance] = useState(taskPriorityValue(task?.importance ?? 0));
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [repeat, setRepeat] = useState<TaskRecurrenceFrequency>('NONE');
  const seriesRef = useRef<TaskSeries | null>(null);
  const repeatRef = useRef<TaskRecurrenceFrequency>('NONE');
  const recurrenceMutationRef = useRef<Promise<void>>(Promise.resolve());
  const recurrenceRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!task?.taskSeriesId) return () => { cancelled = true; };

    api.tasks.recurrence(task.taskId)
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
        description: description.trim(),
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
      <AppInput label="Task" value={name} onChangeText={setName} autoFocus />
      <AppInput label="Details (optional)" value={description} onChangeText={setDescription} multiline />
      <SilentPressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        onPress={() => setCompleted(value => !value)}
        style={({ pressed }) => [styles.completeToggle, { borderColor: colors.border, backgroundColor: completed ? colors.accentSoft : colors.background }, pressed && styles.pressed]}>
        <Ionicons name={completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={completed ? colors.success : colors.textMuted} />
        <AppText variant="label">{completed ? 'Completed' : 'Mark as complete'}</AppText>
      </SilentPressable>
      <View style={task?.parentId ? undefined : styles.scheduleRow}>
        <TaskScheduleField
          value={scheduledPerformDateTime}
          onChange={handleScheduledChange}
          timeOnly={repeat !== 'NONE' && Boolean(scheduledPerformDateTime)}
          style={task?.parentId ? undefined : styles.scheduleCell}
        />
        {!task?.parentId && (
          <View style={styles.repeatCell}>
            <ChoiceChips value={repeat} onChange={changeRepeat} options={[
              { value: 'NONE' as const, label: 'Never' },
              { value: 'DAILY' as const, label: 'Daily' },
              { value: 'WEEKLY' as const, label: 'Weekly' },
              { value: 'MONTHLY' as const, label: 'Monthly' },
            ]} />
          </View>
        )}
      </View>
      <AppText variant="label">Remind me</AppText>
      <ChoiceChips
        value={reminderMinutesBefore ?? -1}
        onChange={value => setReminderMinutesBefore(value === -1 ? null : value)}
        options={REMINDER_OPTIONS}
      />
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
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  scheduleCell: { flex: 1, minWidth: 0 },
  repeatCell: { flex: 1, minWidth: 0, paddingTop: 31 },
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  deleteChoices: { gap: 10 },
  deleteChoice: { width: '100%' },
  completeToggle: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.72 },
});
