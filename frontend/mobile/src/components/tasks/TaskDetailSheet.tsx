import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { titleFontSize } from '../../../../shared/titleFontSize';
import { fieldsFromRepeatRule, NO_REPEAT, repeatRuleFromFields } from '../../../../shared/repeatRule';
import { scheduleOf, seriesStartFor, whenDraftFromSchedule, type WhenChange } from '../../../../shared/whenDraft';
import { taskSeriesTimeUpdate } from '@/lib/taskSeriesTime';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { reportError } from '@/lib/errors';
import { getCachedTaskDetails } from '@/lib/taskDetailsCache';
import { TASK_PRIORITY_OPTIONS, taskPriorityColor, taskPriorityValue } from '@/lib/taskPriority';
import { useAppPopup } from '@/providers/PopupProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { Calendar, Task, TaskSeries } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppPopup } from '../ui/AppPopup';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';
import { TaskWhenField } from './when/TaskWhenField';
import { CalendarDestinationField } from '../calendar/CalendarControls';

function titleSize(name: string) {
  const fontSize = titleFontSize(name, { max: 22, min: 16, shrinkFrom: 40, shrinkTo: 140 });
  return { fontSize, lineHeight: Math.round(fontSize * 1.28) };
}

export function TaskDetailSheet({ task, onClose, onUpdated, onDeleted, onDeletedOccurrence, onDeletedFutureOccurrences, onSubtaskCreated, availableCalendars }: {
  task: Task | null;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onDeletedOccurrence: (taskId: string) => Promise<void>;
  onDeletedFutureOccurrences: (taskId: string) => Promise<void>;
  onSubtaskCreated?: (task: Task) => void;
  availableCalendars?: Calendar[];
}) {
  const { confirm } = useAppPopup();
  const { colors } = useAppTheme();
  const { refresh: refreshWorkspace } = useTaskWorkspace();
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
  const [series, setSeries] = useState<TaskSeries | null>(() => task ? getCachedTaskDetails(task.taskId)?.taskSeries ?? null : null);
  const scheduleValueRef = useRef(task?.scheduledPerformDateTime ?? '');
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
  const [selectedSubtaskIds, setSelectedSubtaskIds] = useState<string[]>([]);
  const [bulkSubtaskBusy, setBulkSubtaskBusy] = useState(false);
  const taskNameInputRef = useRef<TextInput>(null);
  const subtaskInputRef = useRef<TextInput>(null);
  const pendingSubtaskIdRef = useRef<string | null>(null);
  const seriesRef = useRef<TaskSeries | null>(null);
  const [previousTaskId, setPreviousTaskId] = useState(task?.taskId);

  if (previousTaskId !== task?.taskId) {
    setPreviousTaskId(task?.taskId);
    const cached = task && !task.parentId ? getCachedTaskDetails(task.taskId) : undefined;
    setSubtasks(cached?.subtasks ?? []);
    setSubtasksLoading(Boolean(task && !task.parentId && !cached));
    setSubtaskComposerOpen(false);
    setSubtaskName('');
    setSubtaskError(null);
    setSelectedSubtaskIds([]);
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
      setSeries(nextSeries);
    };
    const cached = getCachedTaskDetails(taskId);
    if (cached) applySeries(cached.taskSeries);

    api.tasks.details(task)
      .then(details => {
        if (cancelled) return;
        const nextSeries = details.taskSeries;
        if (!nextSeries) return;
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
        scheduledPerformDateTime: scheduleValueRef.current,
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
    if (!task || task.parentId || subtaskSaving) return;
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

  async function toggleSubtask(subtask: Task, completed = !subtask.completed) {
    setSubtasks(previous => previous.map(item => item.taskId === subtask.taskId ? { ...item, completed } : item));
    try {
      const updated = await api.tasks.update(subtask.taskId, { completed });
      setSubtasks(previous => previous.map(item => item.taskId === updated.taskId ? updated : item));
    } catch (cause) {
      setSubtasks(previous => previous.map(item => item.taskId === subtask.taskId ? subtask : item));
      setSubtaskError(reportError('Could not update subtask', cause));
    }
  }

  const selectedSubtasks = subtasks.filter(item => selectedSubtaskIds.includes(item.taskId));

  function toggleSubtaskSelection(subtaskId: string) {
    setSelectedSubtaskIds(current => current.includes(subtaskId)
      ? current.filter(id => id !== subtaskId)
      : [...current, subtaskId]);
  }

  async function setSelectedSubtasksCompleted() {
    if (bulkSubtaskBusy || selectedSubtasks.length === 0) return;
    const completed = !selectedSubtasks.every(item => item.completed);
    setBulkSubtaskBusy(true);
    try {
      await Promise.all(selectedSubtasks.filter(item => item.completed !== completed)
        .map(item => toggleSubtask(item, completed)));
    } finally {
      setBulkSubtaskBusy(false);
    }
  }

  async function deleteSelectedSubtasks() {
    if (bulkSubtaskBusy || selectedSubtasks.length === 0) return;
    if (!await confirm('Delete subtasks?', `${selectedSubtasks.length} selected subtasks will be deleted.`, 'Delete')) return;
    setBulkSubtaskBusy(true);
    const deletedIds: string[] = [];
    try {
      for (const subtask of selectedSubtasks) {
        try {
          await api.tasks.remove(subtask.taskId);
          deletedIds.push(subtask.taskId);
        } catch (cause) {
          setSubtaskError(reportError('Could not delete subtask', cause));
        }
      }
      setSubtasks(current => current.filter(item => !deletedIds.includes(item.taskId)));
      setSelectedSubtaskIds(current => current.filter(id => !deletedIds.includes(id)));
    } finally {
      setBulkSubtaskBusy(false);
    }
  }

  async function confirmDelete(scope: 'occurrence' | 'future' | 'series') {
    if (!task) return;
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
        await onDeletedOccurrence(task.taskId);
      } else if (scope === 'future') {
        await onDeletedFutureOccurrences(task.taskId);
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
    if (task?.taskSeriesId) {
      setDeletePromptOpen(true);
      return;
    }
    void confirmDelete('series');
  }

  const whenValue = whenDraftFromSchedule(
    scheduledPerformDateTime,
    reminderMinutesBefore,
    series?.active ? repeatRuleFromFields(series) : NO_REPEAT,
    series?.active ? Boolean(series.repeatSubtasks) : false,
  );

  /** Saves the When sheet at once, like the web: a series change cannot wait for "Save changes". */
  async function applyWhen(change: WhenChange) {
    if (!task) return;
    const { next } = change;
    const schedule = scheduleOf(next);
    const currentSeries = seriesRef.current?.active ? seriesRef.current : null;
    const timeZone = currentSeries?.timeZone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setError(null);
    try {
      if (change.scheduleChanged) {
        if (currentSeries && change.scheduleScope === 'all' && schedule) {
          const saved = await api.tasks.updateRecurrence(currentSeries.seriesId, {
            ...taskSeriesTimeUpdate(currentSeries, schedule),
            startDateTime: seriesStartFor(change, whenValue, currentSeries.startDateTime),
          });
          seriesRef.current = saved;
          setSeries(saved);
        } else {
          await api.tasks.update(task.taskId, {
            scheduledPerformDateTime: schedule,
            ...(schedule ? {} : { reminderMinutesBefore: null }),
          });
        }
      }
      const reminderForWholeSeries = Boolean(currentSeries) && change.reminderScope === 'all';
      if (change.reminderChanged && !reminderForWholeSeries) {
        await api.tasks.update(task.taskId, { reminderMinutesBefore: next.reminderMinutesBefore });
      }
      if (change.repeatChanged && !task.parentId) {
        const fields = fieldsFromRepeatRule(next.repeat);
        if (fields.recurrenceFrequency === 'NONE') {
          if (currentSeries) {
            await api.tasks.stopRecurrence(currentSeries.seriesId);
            const stopped = { ...currentSeries, active: false };
            seriesRef.current = stopped;
            setSeries(stopped);
          }
        } else if (schedule) {
          const recurrence = {
            ...fields,
            recurrenceFrequency: fields.recurrenceFrequency,
            recurrenceDaysOfWeek: fields.recurrenceDaysOfWeek ?? [],
            timeZone,
            repeatSubtasks: next.repeatSubtasks,
          };
          const saved = seriesRef.current?.active
            ? await api.tasks.updateRecurrence(seriesRef.current.seriesId, { ...recurrence, active: true })
            : await api.tasks.startRecurrence(task.taskId, recurrence);
          seriesRef.current = saved;
          setSeries(saved);
        }
      }
      if (change.reminderChanged && reminderForWholeSeries && currentSeries) {
        await api.tasks.updateRecurrenceReminder(currentSeries.seriesId, next.reminderMinutesBefore);
      }
      const updated = await api.tasks.get(task.taskId);
      scheduleValueRef.current = updated.scheduledPerformDateTime ?? '';
      setScheduledPerformDateTime(scheduleValueRef.current);
      setReminderMinutesBefore(updated.reminderMinutesBefore ?? null);
      onUpdated(updated);
      await refreshWorkspace();
    } catch (cause) {
      setError(reportError('Could not save the date, reminder or repeat', cause));
      throw cause;
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
          onChangeText={text => setName(text.replace(/\s*\n\s*/g, ' '))}
          // Wrapping keeps the whole name visible: a one-line input scrolls to the caret and hides the start.
          multiline
          submitBehavior="blurAndSubmit"
          style={[
            styles.taskTitleInput,
            styles.taskNameDirection,
            titleSize(name),
            completed && styles.completed,
          ]}
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
          {selectedSubtasks.length > 0 && (
            <View style={styles.subtaskSelectionActions}>
              <AppText variant="caption" color="muted">{selectedSubtasks.length} selected</AppText>
              <AppButton compact variant="ghost"
                label={selectedSubtasks.every(item => item.completed) ? 'Reopen' : 'Complete'}
                icon={selectedSubtasks.every(item => item.completed) ? 'refresh' : 'checkmark'}
                loading={bulkSubtaskBusy} onPress={() => void setSelectedSubtasksCompleted()} />
              <AppButton compact variant="ghost" label="Delete" icon="trash-outline"
                loading={bulkSubtaskBusy} onPress={() => void deleteSelectedSubtasks()} />
              <AppButton compact variant="ghost" label="Clear" icon="close"
                onPress={() => setSelectedSubtaskIds([])} />
            </View>
          )}
          {subtasksLoading && <AppText variant="caption" color="muted">Loading subtasks…</AppText>}
          {subtasks.map(subtask => (
            <SilentPressable
              key={subtask.taskId}
              accessibilityRole={selectedSubtasks.length ? 'button' : 'checkbox'}
              accessibilityState={selectedSubtasks.length
                ? { selected: selectedSubtaskIds.includes(subtask.taskId) }
                : { checked: subtask.completed }}
              onPress={() => {
                if (subtask.taskId === pendingSubtaskId) return;
                if (selectedSubtasks.length) toggleSubtaskSelection(subtask.taskId);
                else void toggleSubtask(subtask);
              }}
              onLongPress={() => { if (subtask.taskId !== pendingSubtaskId) toggleSubtaskSelection(subtask.taskId); }}
              accessibilityHint={selectedSubtasks.length ? 'Tap to select or deselect.' : 'Tap to update completion. Hold to select multiple.'}
              style={({ pressed }) => [styles.subtaskRow, { borderColor: colors.border, backgroundColor: selectedSubtaskIds.includes(subtask.taskId) ? colors.accentSoft : colors.background }, pressed && styles.pressed]}>
              <Ionicons name={selectedSubtaskIds.includes(subtask.taskId) ? 'checkmark-circle' : subtask.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selectedSubtaskIds.includes(subtask.taskId) ? colors.accent : subtask.completed ? colors.success : colors.textMuted} />
              <AppText variant="label" numberOfLines={2} style={[styles.subtaskName, styles.taskNameDirection, subtask.completed && styles.completed]}>{subtask.name}</AppText>
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
                style={styles.taskNameDirection}
              />
              <AppButton compact label="Add" icon="add" loading={subtaskSaving} onPress={() => void submitSubtask()} style={styles.subtaskButton} />
            </View>
          ) : (
            <AppButton compact variant="ghost" label="Add subtask" icon="add" onPress={() => setSubtaskComposerOpen(true)} style={styles.addSubtaskButton} />
          )}
          {subtaskError && <AppText variant="caption" color="danger">{subtaskError}</AppText>}
        </View>
      )}
      <TaskWhenField
        value={whenValue}
        repeating={Boolean(series?.active)}
        canRepeat={!task?.parentId}
        showRepeatSubtasks={subtasks.length > 0}
        onSave={applyWhen} />
      <AppText variant="label">Priority</AppText>
          <ChoiceChips value={importance} onChange={handlePriorityChange} options={[...TASK_PRIORITY_OPTIONS]} fillSelected />
      {error && <AppText color="danger">{error}</AppText>}
      <View style={styles.actions}>
        <AppButton label="Delete" icon="trash-outline" variant="danger" onPress={requestDelete} disabled={deleting} style={styles.grow} />
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
              disabled={deleting}
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
  taskNameDirection: { writingDirection: 'auto', textAlign: 'auto' },
  taskTitleInput: { minHeight: 0, maxHeight: 132, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', fontWeight: '600', textAlignVertical: 'top' },
  completeToggle: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },
  subtasks: { gap: 8 },
  subtasksHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subtaskSelectionActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
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
