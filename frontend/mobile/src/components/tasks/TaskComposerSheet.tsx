import { useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { localDateTime } from '@/lib/date';
import { api } from '@/services/api';
import type { Task } from '@/types/models';

type Schedule = 'today' | 'tomorrow' | 'none';

function scheduledDate(choice: Schedule): string {
  if (choice === 'none') return '';
  const date = new Date();
  if (choice === 'tomorrow') date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return localDateTime(date);
}

export function TaskComposerSheet({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState(1);
  const [schedule, setSchedule] = useState<Schedule>('today');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setImportance(1);
    setSchedule('today');
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the task a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const task = await api.tasks.create({
        name: name.trim(),
        description: description.trim(),
        scheduledPerformDateTime: scheduledDate(schedule),
        tag: '',
        importance,
      });
      onCreated(task);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title="New task"
      footer={<AppButton label="Add task" icon="add" loading={saving} onPress={() => void submit()} />}>
      <AppInput autoFocus label="What needs doing?" value={name} onChangeText={setName} error={error ?? undefined} />
      <AppInput label="Details (optional)" value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">When</AppText>
      <ChoiceChips value={schedule} onChange={setSchedule} options={[
        { value: 'today', label: 'Today' },
        { value: 'tomorrow', label: 'Tomorrow' },
        { value: 'none', label: 'Someday' },
      ]} />
      <AppText variant="label">Priority</AppText>
      <ChoiceChips value={importance} onChange={setImportance} options={[
        { value: 1, label: 'Low' },
        { value: 2, label: 'Medium' },
        { value: 3, label: 'High' },
      ]} />
    </ModalSheet>
  );
}
