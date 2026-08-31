import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { Task } from '@/types/models';
import { AppText } from '../ui/AppText';

export function TaskRow({ task, onToggle, onPress, onDelete }: {
  task: Task;
  onToggle: () => void;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useAppTheme();
  const priority = task.importance >= 3 ? colors.high : task.importance === 2 ? colors.medium : colors.low;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={[styles.priority, { backgroundColor: priority }]} />
      <Pressable
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        onPress={event => { event.stopPropagation(); onToggle(); }}>
        <Ionicons
          name={task.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={25}
          color={task.completed ? colors.success : colors.textMuted}
        />
      </Pressable>
      <View style={styles.copy}>
        <AppText variant="label" style={task.completed ? styles.completed : undefined} numberOfLines={2}>
          {task.name}
        </AppText>
        <AppText variant="caption" color="muted">
          {formatShortDate(task.scheduledPerformDateTime)}{formatTime(task.scheduledPerformDateTime) ? ` · ${formatTime(task.scheduledPerformDateTime)}` : ''}
        </AppText>
      </View>
      {onDelete && (
        <Pressable hitSlop={10} onPress={event => { event.stopPropagation(); onDelete(); }}>
          <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priority: { width: 5, height: 34, borderRadius: 3 },
  copy: { flex: 1, gap: 4 },
  completed: { textDecorationLine: 'line-through', opacity: 0.52 },
});
