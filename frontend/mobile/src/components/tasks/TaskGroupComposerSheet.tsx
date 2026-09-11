import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { SilentPressable } from '@/components/ui/SilentPressable';
import { reportError } from '@/lib/errors';
import { useTaskWorkspace } from '@/providers/TaskWorkspaceProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { Task, TaskGroup } from '@/types/models';

export function TaskGroupComposerSheet({ visible, taskIds, availableTasks, group, onClose, onCreated }: {
  visible: boolean;
  taskIds: string[];
  availableTasks?: Task[];
  group?: TaskGroup | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { createGroup, renameGroup, replaceGroupTasks } = useTaskWorkspace();
  const { colors } = useAppTheme();
  const nameInputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(taskIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return undefined;

    const focusTimer = setTimeout(() => {
      setName(group?.name ?? '');
      setSelectedTaskIds(group?.taskIds ?? taskIds);
      nameInputRef.current?.focus();
    }, 220);
    return () => clearTimeout(focusTimer);
  }, [group, taskIds, visible]);

  function close() {
    setName('');
    setSelectedTaskIds(group?.taskIds ?? taskIds);
    setError(null);
    onClose();
  }

  async function submit() {
    if (!name.trim()) {
      setError('Give the group a name.');
      return;
    }
    if (selectedTaskIds.length < 2) {
      setError('Choose at least two tasks.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (group) {
        await renameGroup(group.groupId, name.trim());
        if (selectedTaskIds.length !== group.taskIds.length
          || selectedTaskIds.some((taskId, index) => taskId !== group.taskIds[index])) {
          await replaceGroupTasks(group.groupId, selectedTaskIds);
        }
      } else {
        await createGroup(name.trim(), selectedTaskIds);
      }
      onCreated();
      close();
    } catch (cause) {
      setError(reportError('Could not create group', cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      title={group ? 'Edit group' : 'Group tasks'}
      footer={<AppButton label={group ? 'Save group' : 'Create group'} icon="folder-open-outline" loading={saving} onPress={() => void submit()} />}>
      <AppText color="muted">
        {availableTasks ? 'Choose at least two tasks to keep together.' : `Keep these ${selectedTaskIds.length} tasks together in your workspace.`}
      </AppText>
      <AppInput ref={nameInputRef} autoFocus label="Group name" value={name} onChangeText={setName} error={error ?? undefined} />
      {availableTasks && (
        <View style={styles.taskList}>
          {availableTasks.map(task => {
            const selected = selectedTaskIds.includes(task.taskId);
            return (
              <SilentPressable
                key={task.taskId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setError(null);
                  setSelectedTaskIds(previous => previous.includes(task.taskId)
                    ? previous.filter(taskId => taskId !== task.taskId)
                    : [...previous, task.taskId]);
                }}
                style={({ pressed }) => [
                  styles.task,
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surface },
                  pressed && styles.pressed,
                ]}>
                <AppText variant="label" numberOfLines={2} style={styles.taskName}>{task.name}</AppText>
                <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.accent : colors.textMuted} />
              </SilentPressable>
            );
          })}
        </View>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  taskList: { gap: 8 },
  task: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskName: { flex: 1 },
  pressed: { opacity: 0.72 },
});
