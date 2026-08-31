import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { api } from '@/services/api';
import type { Task } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppText } from '../ui/AppText';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function TaskDetailSheet({ task, onClose, onUpdated, onDeleted }: {
  task: Task | null;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [importance, setImportance] = useState(task?.importance || 1);
  const [saving, setSaving] = useState(false);
  const [focusStarting, setFocusStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!task || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.tasks.update(task.taskId, {
        name: name.trim(),
        description: description.trim(),
        importance,
      });
      onUpdated(updated);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  }

  async function startFocus() {
    if (!task) return;
    setFocusStarting(true);
    setError(null);
    try {
      await api.tasks.startPomodoro(task.taskId);
      Alert.alert('Focus started', 'Your 25-minute focus session is running.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start focus.');
    } finally {
      setFocusStarting(false);
    }
  }

  function confirmDelete() {
    if (!task) return;
    Alert.alert('Delete task?', task.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void api.tasks.remove(task.taskId).then(() => {
          onDeleted(task.taskId);
          onClose();
        }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not delete this task.')),
      },
    ]);
  }

  return (
    <ModalSheet
      visible={Boolean(task)}
      onClose={onClose}
      title="Task details"
      footer={<AppButton label="Save changes" loading={saving} onPress={() => void save()} />}>
      <AppInput label="Task" value={name} onChangeText={setName} />
      <AppInput label="Details" multiline value={description} onChangeText={setDescription} />
      <AppText variant="label">Priority</AppText>
      <ChoiceChips value={importance} onChange={setImportance} options={[
        { value: 1, label: 'Low' }, { value: 2, label: 'Medium' }, { value: 3, label: 'High' },
      ]} />
      {error && <AppText color="danger">{error}</AppText>}
      <View style={styles.actions}>
        <AppButton label="Start focus" icon="timer-outline" variant="secondary" loading={focusStarting} onPress={() => void startFocus()} style={styles.grow} />
        <AppButton label="Delete" icon="trash-outline" variant="danger" onPress={confirmDelete} style={styles.grow} />
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
});
