import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TaskRow } from '@/components/tasks/TaskRow';
import { reportError } from '@/lib/errors';
import { playAudioFeedback } from '@/lib/audioFeedback';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { api } from '@/services/api';
import type { AttentionState, ClosureType, MentalThread } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppInput } from '../ui/AppInput';
import { AppSlider } from '../ui/AppSlider';
import { AppText } from '../ui/AppText';
import { SilentPressable } from '../ui/SilentPressable';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ModalSheet } from '../ui/ModalSheet';

export function ThreadDetailSheet({ thread, onClose, onUpdated }: {
  thread: MentalThread | null;
  onClose: () => void;
  onUpdated: (thread: MentalThread) => void;
}) {
  const [title, setTitle] = useState(thread?.title ?? '');
  const [description, setDescription] = useState(thread?.description ?? '');
  const [desired, setDesired] = useState(thread?.desiredResolution ?? '');
  const [load, setLoad] = useState(thread?.currentMentalLoad ?? 5);
  const [attention, setAttention] = useState<AttentionState>(thread?.attentionState ?? 'PENDING');
  const [closure, setClosure] = useState<ClosureType>(thread?.closureType ?? 'RESOLVED');
  const [resolution, setResolution] = useState(thread?.resolutionSummary ?? '');
  const [saving, setSaving] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const { allTasks, addTask, updateTask } = useTaskWorkspace();
  const { colors } = useAppTheme();
  const editable = thread?.status === 'OPEN';
  const stateColor = attention === 'ACTING'
    ? colors.accent
    : attention === 'RUMINATING'
      ? colors.danger
      : attention === 'PLANNED'
        ? colors.success
        : colors.warning;
  const stateLabel = attention[0] + attention.slice(1).toLowerCase();
  const stateOptions = [
    { value: 'ACTING' as const, label: 'Acting', color: colors.accent },
    { value: 'RUMINATING' as const, label: 'Ruminating', color: colors.danger },
    { value: 'PLANNED' as const, label: 'Planned', color: colors.success },
    { value: 'PENDING' as const, label: 'Pending', color: colors.warning },
  ];
  const threadTasks = useMemo(
    () => thread ? allTasks.filter(task => task.mentalThreadId === thread.id && !task.parentId) : [],
    [allTasks, thread],
  );

  async function save() {
    if (!thread || !title.trim() || !Number.isInteger(load) || load < 1 || load > 10) return;
    setSaving(true); setError(null);
    try {
      const updated = await api.mentalThreads.update(thread.id, {
        title: title.trim(), description: description.trim() || null, attentionState: attention,
        desiredResolution: desired.trim() || null, targetCloseDate: thread.targetCloseDate,
        hardDeadlineDate: thread.hardDeadlineDate, nextReviewDate: thread.nextReviewDate,
        currentMentalLoad: load, loadReason: null,
      });
      onUpdated(updated); onClose();
    } catch (cause) { setError(reportError('Could not save thread', cause)); }
    finally { setSaving(false); }
  }

  async function changeClosedState() {
    if (!thread) return;
    setSaving(true); setError(null);
    try {
      const updated = thread.status === 'OPEN'
        ? await api.mentalThreads.close(thread.id, closure, resolution.trim() || null)
        : await api.mentalThreads.reopen(thread.id);
      onUpdated(updated); onClose();
    } catch (cause) { setError(reportError('Could not update thread', cause)); }
    finally { setSaving(false); }
  }

  async function createTask() {
    if (!thread || thread.status !== 'OPEN' || !taskName.trim() || taskSaving) return;
    setTaskSaving(true); setError(null);
    try {
      const task = await api.tasks.create({
        name: taskName.trim(), description: '', scheduledPerformDateTime: '', tag: '', importance: 0,
        mentalThreadId: thread.id,
      });
      addTask(task);
      setTaskName('');
    } catch (cause) {
      setError(reportError('Could not create task', cause));
    } finally { setTaskSaving(false); }
  }

  async function toggleTask(task: typeof threadTasks[number]) {
    const optimistic = { ...task, completed: !task.completed };
    updateTask(optimistic);
    try {
      const updated = await api.tasks.update(task.taskId, { completed: optimistic.completed });
      updateTask(updated);
      if (optimistic.completed) playAudioFeedback('taskCompleted');
    } catch (cause) {
      updateTask(task);
      setError(reportError('Could not update task', cause));
    }
  }

  return (
    <ModalSheet
      visible={Boolean(thread)}
      onClose={onClose}
      title={thread?.status === 'CLOSED' ? 'Closed thread' : 'Mental thread'}
      footer={editable ? <AppButton label="Save changes" loading={saving} onPress={() => void save()} /> : undefined}
    >
      <View style={styles.form}>
        <AppInput
          autoFocus
          editable={editable}
          label="What keeps returning?"
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.optionSection}>
          <AppText variant="label">Attention state</AppText>
          <SilentPressable
            accessibilityRole="button"
            accessibilityLabel={`Attention state: ${stateLabel}. Tap to change.`}
            disabled={!editable}
            onPress={() => setStatePickerOpen(current => !current)}
            style={({ pressed }) => [styles.stateChip, { backgroundColor: `${stateColor}20`, borderColor: stateColor }, pressed && styles.pressed]}
          >
            <AppText variant="label" style={{ color: stateColor }}>{stateLabel}</AppText>
          </SilentPressable>
          {statePickerOpen && editable && (
            <View style={[styles.stateOptions, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
              {stateOptions.map(option => (
                <SilentPressable
                  key={option.value}
                  onPress={() => { setAttention(option.value); setStatePickerOpen(false); }}
                  style={({ pressed }) => [styles.stateOption, pressed && styles.pressed]}
                >
                  <View style={[styles.stateDot, { backgroundColor: option.color }]} />
                  <AppText>{option.label}</AppText>
                </SilentPressable>
              ))}
            </View>
          )}
        </View>
        <AppInput
          editable={editable}
          label="Context"
          multiline
          value={description}
          onChangeText={setDescription}
        />
        <AppInput
          editable={editable}
          label="What would make this feel complete?"
          multiline
          value={desired}
          onChangeText={setDesired}
        />
        <View style={styles.loadSection}>
          <View style={styles.sectionHeading}>
            <AppText variant="label">Mental load</AppText>
            <AppText variant="label" style={{ color: stateColor }}>{load}/10</AppText>
          </View>
          <AppSlider
            label="Mental load"
            value={load}
            minimumValue={1}
            maximumValue={10}
            minimumLabel="Light"
            maximumLabel="Heavy"
            activeColor={stateColor}
            disabled={!editable}
            onValueChange={setLoad}
          />
        </View>
      </View>
      <View style={styles.tasks}>
        <AppText variant="heading">Next actions</AppText>
        {threadTasks.map(task => (
          <TaskRow key={task.taskId} task={task} onToggle={() => void toggleTask(task)} onPress={() => void toggleTask(task)} />
        ))}
        {!threadTasks.length && <AppText color="muted">No next actions yet.</AppText>}
        {thread?.status === 'OPEN' && (
          <View style={styles.taskComposer}>
            <View style={styles.taskInput}>
              <AppInput
                label="Add a next action"
                value={taskName}
                onChangeText={setTaskName}
                onSubmitEditing={() => void createTask()}
                returnKeyType="done"
              />
            </View>
            <AppButton compact label="Add" icon="add" loading={taskSaving} disabled={!taskName.trim()} onPress={() => void createTask()} />
          </View>
        )}
      </View>
      {thread?.status === 'OPEN' && (
        <View style={styles.closure}>
          <AppText variant="heading">Close the loop</AppText>
          <ChoiceChips value={closure} onChange={setClosure} options={[
            { value: 'RESOLVED', label: 'Resolved' }, { value: 'ACCEPTED', label: 'Accepted' }, { value: 'RELEASED', label: 'Released' },
          ]} />
          <AppInput
            label="What changed? (optional)"
            multiline
            value={resolution}
            onChangeText={setResolution}
          />
        </View>
      )}
      {error && <AppText color="danger">{error}</AppText>}
      <AppButton
        variant="secondary"
        label={thread?.status === 'OPEN' ? 'Close thread' : 'Reopen thread'}
        icon={thread?.status === 'OPEN' ? 'checkmark-circle-outline' : 'refresh-outline'}
        loading={saving}
        onPress={() => void changeClosedState()}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  optionSection: { gap: 8 },
  stateChip: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  stateOptions: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  stateOption: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stateDot: { width: 9, height: 9, borderRadius: 5 },
  loadSection: { gap: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pressed: { opacity: 0.72 },
  closure: { gap: 12, paddingTop: 8 },
  tasks: { gap: 10, paddingTop: 8 },
  taskComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  taskInput: { flex: 1 },
});
