import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppPopup } from '@/components/ui/AppPopup';
import { AppText } from '@/components/ui/AppText';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { localDateTime } from '@/lib/date';
import { reportError } from '@/lib/errors';
import { TASK_PRIORITY_OPTIONS } from '@/lib/taskPriority';
import { api } from '@/services/api';
import type { Task } from '@/types/models';
import { dateFromScheduleValue, TaskDateTimePicker } from './TaskScheduleField';

type Schedule = 'today' | 'tomorrow' | 'custom';

function scheduledDate(choice: Exclude<Schedule, 'custom'>): string {
  const date = new Date();
  if (choice === 'tomorrow') date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return localDateTime(date);
}

function customDateTime(initialDate?: string): string {
  if (!initialDate) return '';
  const date = new Date(`${initialDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : localDateTime(date);
}

export function TaskComposerSheet({ visible, onClose, onCreated, initialDate }: {
  visible: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void | Promise<void>;
  initialDate?: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importance, setImportance] = useState<number>(TASK_PRIORITY_OPTIONS[0].value);
  const [schedule, setSchedule] = useState<Schedule>(initialDate ? 'custom' : 'today');
  const [customSchedule, setCustomSchedule] = useState(() => customDateTime(initialDate));
  const [customScheduleOpen, setCustomScheduleOpen] = useState(false);
  const [customScheduleDraft, setCustomScheduleDraft] = useState(() => dateFromScheduleValue(null));
  const previousSchedule = useRef<Exclude<Schedule, 'custom'>>('today');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setImportance(TASK_PRIORITY_OPTIONS[0].value);
    setSchedule(initialDate ? 'custom' : 'today');
    setCustomSchedule(customDateTime(initialDate));
    setCustomScheduleOpen(false);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function chooseSchedule(choice: Schedule) {
    if (choice === 'custom') {
      if (schedule !== 'custom') previousSchedule.current = schedule;
      setCustomScheduleDraft(dateFromScheduleValue(customSchedule));
      setSchedule('custom');
      setCustomScheduleOpen(true);
      return;
    }
    setSchedule(choice);
  }

  function cancelCustomSchedule() {
    setCustomScheduleOpen(false);
    if (!customSchedule) setSchedule(previousSchedule.current);
  }

  function saveCustomSchedule() {
    setCustomSchedule(localDateTime(customScheduleDraft));
    setSchedule('custom');
    setCustomScheduleOpen(false);
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
        scheduledPerformDateTime: schedule === 'custom' ? customSchedule : scheduledDate(schedule),
        tag: '',
        importance,
      });
      await onCreated(task);
      close();
    } catch (cause) {
      setError(reportError('Could not create task', cause));
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
      <ChoiceChips value={schedule} onChange={chooseSchedule} options={[
        { value: 'today', label: 'Today' },
        { value: 'tomorrow', label: 'Tomorrow' },
        { value: 'custom', label: 'Custom' },
      ]} />
      {schedule === 'custom' && customSchedule && (
        <AppText variant="caption" color="muted">
          {`Set for ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(customSchedule))}`}
        </AppText>
      )}
      <AppText variant="label">Priority</AppText>
      <ChoiceChips value={importance} onChange={setImportance} options={[...TASK_PRIORITY_OPTIONS]} />
      <AppPopup
        visible={customScheduleOpen}
        title="Custom schedule"
        showIcon={false}
        onClose={cancelCustomSchedule}
        dismissOnBackdrop={false}
        footer={(
          <View style={styles.popupActions}>
            <AppButton style={styles.popupAction} variant="secondary" label="Cancel" onPress={cancelCustomSchedule} />
            <AppButton style={styles.popupAction} label="Done" onPress={saveCustomSchedule} />
          </View>
        )}>
        <TaskDateTimePicker key={`${customScheduleOpen}-${customSchedule}`} value={customScheduleDraft} onChange={setCustomScheduleDraft} />
      </AppPopup>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  popupActions: { flexDirection: 'row', gap: 10 },
  popupAction: { flex: 1 },
});
