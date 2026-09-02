import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { reportError } from '@/lib/errors';
import { TASK_PRIORITY_OPTIONS, taskPriorityValue } from '@/lib/taskPriority';
import { useAppPopup } from '@/providers/PopupProvider';
import { api } from '@/services/api';
import type { Task } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';
import { TaskScheduleField } from './TaskScheduleField';

export function TaskDetailSheet({ task, onClose, onUpdated, onStartFocus, onDeleted }: {
  task: Task | null;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onStartFocus?: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}) {
  const { confirm } = useAppPopup();
  const [name, setName] = useState(task?.name ?? '');
  const [scheduledPerformDateTime, setScheduledPerformDateTime] = useState(task?.scheduledPerformDateTime ?? '');
  const [importance, setImportance] = useState(taskPriorityValue(task?.importance ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!task || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.tasks.update(task.taskId, {
        name: name.trim(),
        scheduledPerformDateTime,
        importance,
      });
      onUpdated(updated);
      onClose();
    } catch (cause) {
      setError(reportError('Could not save task', cause));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!task) return;
    if (!await confirm('Delete task?', task.name, 'Delete')) return;
    try {
      await api.tasks.remove(task.taskId);
      onDeleted(task.taskId);
      onClose();
    } catch (cause) {
      setError(reportError('Could not delete task', cause));
    }
  }

  return (
    <ModalSheet
      visible={Boolean(task)}
      onClose={onClose}
      title="Task details"
      footer={<AppButton label="Save changes" loading={saving} onPress={() => void save()} />}>
      <AppInput label="Task" value={name} onChangeText={setName} />
      <TaskScheduleField value={scheduledPerformDateTime} onChange={setScheduledPerformDateTime} />
      <AppText variant="label">Priority</AppText>
      <ChoiceChips value={importance} onChange={setImportance} options={[...TASK_PRIORITY_OPTIONS]} />
      {error && <AppText color="danger">{error}</AppText>}
      <View style={styles.actions}>
        {onStartFocus && task && <AppButton label="Focus options" icon="timer-outline" variant="secondary" onPress={() => { onClose(); onStartFocus(task); }} style={styles.grow} />}
        <AppButton label="Delete" icon="trash-outline" variant="danger" onPress={confirmDelete} style={styles.grow} />
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
