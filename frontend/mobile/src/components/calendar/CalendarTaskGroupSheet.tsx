import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { Task, TaskGroup } from '@/types/models';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { ModalSheet } from '../ui/ModalSheet';
import { SilentPressable } from '../ui/SilentPressable';

export function CalendarTaskGroupSheet({ group, tasks, onClose, onTaskPress }: {
  group: TaskGroup | null;
  tasks: Task[];
  onClose: () => void;
  onTaskPress: (task: Task) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <ModalSheet
      visible={Boolean(group)}
      onClose={onClose}
      title={group?.name ?? 'Task group'}
      footer={<AppButton variant="secondary" label="Close" onPress={onClose} />}>
      <AppText color="muted">Tasks in this group that match the calendar filters.</AppText>
      {tasks.length ? tasks.map(task => (
        <SilentPressable
          key={task.taskId}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${task.name || 'untitled task'}`}
          onPress={() => onTaskPress(task)}
          style={({ pressed }) => [styles.task, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
          <View style={[styles.status, { backgroundColor: task.completed ? `${colors.success}20` : colors.accentSoft }]}>
            <Ionicons name={task.completed ? 'checkmark' : 'checkmark-outline'} size={17} color={task.completed ? colors.success : colors.accent} />
          </View>
          <View style={styles.copy}>
            <AppText variant="label" style={task.completed ? styles.completed : undefined} numberOfLines={2}>{task.name || 'Untitled task'}</AppText>
            <AppText variant="caption" color="muted">{formatShortDate(task.scheduledPerformDateTime)}{formatTime(task.scheduledPerformDateTime) ? ` · ${formatTime(task.scheduledPerformDateTime)}` : ''}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        </SilentPressable>
      )) : (
        <View style={styles.empty}><AppText color="muted">No tasks in this group match the current filters.</AppText></View>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  task: { minHeight: 62, borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  status: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  completed: { textDecorationLine: 'line-through', opacity: 0.52 },
  empty: { minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
