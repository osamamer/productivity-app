import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate, formatTime } from '@/lib/date';
import { useAppTheme } from '@/providers/ThemeProvider';
import type { PomodoroStatus, Task } from '@/types/models';
import { PomodoroPanel } from '../pomodoro/PomodoroPanel';
import { AppText } from '../ui/AppText';

export function TaskRow({ task, onToggle, onPress, onDelete, onPomodoroPress, pomodoroOpen, pomodoroStatus, onPomodoroClose, onPomodoroActiveChange, onPomodoroStatusChange }: {
  task: Task;
  onToggle: () => void;
  onPress?: () => void;
  onDelete?: () => void;
  onPomodoroPress?: () => void;
  pomodoroOpen?: boolean;
  pomodoroStatus?: PomodoroStatus | null;
  onPomodoroClose?: () => void;
  onPomodoroActiveChange?: (active: boolean) => void;
  onPomodoroStatusChange?: (status: PomodoroStatus) => void;
}) {
  const { colors } = useAppTheme();
  const priority = task.importance >= 3 ? colors.high : task.importance === 2 ? colors.medium : colors.low;
  const active = Boolean(pomodoroStatus?.active);
  const progress = pomodoroStatus
    ? (() => {
        const passed = Math.max(0, pomodoroStatus.secondsPassedInSession);
        const remaining = Math.max(0, pomodoroStatus.secondsUntilNextTransition);
        const total = passed + remaining;
        return total > 0 ? Math.min(1, passed / total) : 0;
      })()
    : 0;
  const resting = pomodoroStatus?.phase === 'BREAK'
    || pomodoroStatus?.phase === 'WAITING_FOR_BREAK'
    || Boolean(pomodoroStatus && !pomodoroStatus.sessionActive);
  return (
    <View style={[styles.container, {
      backgroundColor: active ? colors.accentSoft : colors.surface,
      borderColor: active ? (resting ? colors.success : colors.accent) : colors.border,
    }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
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
        {onPomodoroPress && (
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={pomodoroOpen ? 'Close focus timer' : 'Open focus timer'}
            onPress={event => { event.stopPropagation(); onPomodoroPress(); }}>
            <Ionicons name="timer-outline" size={21} color={active || pomodoroOpen ? colors.accent : colors.textMuted} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable hitSlop={10} onPress={event => { event.stopPropagation(); onDelete(); }}>
            <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
          </Pressable>
        )}
      </Pressable>
      {pomodoroOpen && onPomodoroActiveChange && onPomodoroStatusChange && (
        <PomodoroPanel
          taskId={task.taskId}
          initialStatus={pomodoroStatus}
          onClose={onPomodoroClose ?? (() => undefined)}
          onActiveChange={onPomodoroActiveChange}
          onStatusChange={onPomodoroStatusChange}
        />
      )}
      {active && (
        <View style={[styles.progressTrack, { backgroundColor: resting ? `${colors.success}28` : colors.accentSoft }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: resting ? colors.success : colors.accent }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    minHeight: 68,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priority: { width: 5, height: 34, borderRadius: 3 },
  copy: { flex: 1, gap: 4 },
  completed: { textDecorationLine: 'line-through', opacity: 0.52 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
});
